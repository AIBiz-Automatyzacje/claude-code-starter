# INSPIRACJE — mattpocock/skills i wystąpienie poteto (pstack) na tle pipeline'u dev-*

**Data:** 2026-09-24 (v2 — po transkrypcji wystąpienia). **Temat operatora:** „czy są tam rzeczy, które warto wziąć do nas i nad którymi warto się pochylić”, bez dużego narzutu na proces.
**Charakter:** raport. Niczego nie zmieniono w `.claude/` ani w CLAUDE.md.
**DECYZJE OPERATORA 2026-09-24 (HANDOFF 6a pkt 26 — tam pełny zapis):** WEŹ: A1 (+ wyjątek w coding-rules §2: zielony test niefalsyfikowalny wolno usunąć,
gdy nie da się przepisać, z wpisem w raporcie), A2, A3, A4, A5 (w brzmieniu: prompty według wytycznych Anthropic, zmiany reviewerów/builderów ślepo przed/po);
lint a stary kod — sprzątanie PRZED nowym workflow, każda nowa reguła razem z posprzątaniem. WYMOGI PANELU (PANEL-WEJSCIE §2 pkt 14–16): B1 wariant b
(regresja c odłożona z warunkiem), B6 w ESLint bez dependency-cruiser, bez wyjątku dla auth, B7 automatycznie na zamknięciu zadania. OTWARTA DLA PANELU: B2.
ODRZUCONE: B3, B4, B5, B8, C1–C6, drabina jako zasada przekrojowa panelu (§5 pkt 1 nieaktualny; szczebel zostaje w compoundzie).
**Wersja dla operatora:** `INSPIRACJE-POCOCK-PSTACK-DLA-OPERATORA.md`.

## 0. Źródła, zakres, ograniczenia

- **Wystąpienie poteto** (Lauren Tan; React core team, wcześniej Cursor, dziś Grokbot w SpaceX AI), X 2026-09-21, 38:02 — **transkrypcja Whisper od operatora** (surowa, bez korekty; `…/Zasoby/Research/X/poteto-2102050467505430555/transkrypcja.md`, poza repo). Cytaty niżej z minutą. W treści mówi o **2 000** PR w miesiącu (00:09), tytuł wpisu podaje 2 500; obie liczby to deklaracja bez audytu i bez wskaźnika cofnięć. O samym pluginie mówi wprost, że „nie będzie o nim dużo opowiadać” (13:18).
- **pstack** — `cursor/plugins/pstack`, klon HEAD `12d587d` (2026-09-23): 47 skilli (23 zasady `principle-*` + 24), 23 playbooki routera `poteto-mode`, 2 agenci, 7 549 linii `.md`. Służy tu jako szczegół techniczny do tego, co wystąpienie mówi ogólnie.
- **mattpocock/skills** — klon HEAD `c55ee46` (2026-09-18), 38 skilli, zero plików subagentów. Poprzedni przegląd 2026-07 (`ZRODLA-SZABLONU.md`); od tego czasu m.in. `retro`, `pr`, `implement-spec`, `setup-ts-deep-modules`, `wizard`, `writing-for-agents`, `to-questionnaire`, `wait-what`.
- Inwentarz obu repo: `skrypty/insp_inwentarz.py` → `dane/insp-inwentarz.txt`. Uwagi bota o komentarzach: `skrypty/insp_komentarze.py` → `dane/insp-komentarze.txt`.
- v1 tego raportu powstała bez nagrania (repo + omówienia wtórne). Transkrypcja przesunęła środek ciężkości: rdzeniem wystąpienia nie są skille, tylko **drabina zaufania i kod bazy jako pamięć agentów** (§1). Zmiany względem v1: A2 rozszerzone o drabinę, B1 z cytatami, B6 wzmocnione, nowe B7 (ogrodnik), komentarze przeniesione z „nie bierzemy” do B8 z danymi, pętla zewnętrzna w §4.

**Kontekst naszego pipeline'u** (obowiązuje, nie ruszam): decyzje 6a pkt 1–25, wymogi PANEL-WEJSCIE §2, zasady warstwy stałej z prompt-auditu (§2a).

## 1. Co faktycznie mówi wystąpienie (streszczenie z minutami)

1. **Teza: zaufanie** (00:18–05:11). Autorka była wąskim gardłem; chciała przenieść swoją wiedzę na agentów, żeby nie blokować wszystkiego. Przejście z 1–5 agentów „pilnowanych w każdym czacie” do ~100 blokuje brak zaufania; puszczenie setki agentów bez niego daje „slop PR-y”, regresje i błędy (06:25–06:36). Metafora: nie fabryka, tylko **kuchnia z gwiazdką Michelin** — nie gotujesz każdego składnika, ale odpowiadasz za danie i za ustawienie kuchni (00:53–01:53).
2. **Weryfikacja** (07:15–12:33). Spektrum od skilli weryfikacji (agent uruchamia aplikację przez Chrome DevTools Protocol, zbiera ślady, heap snapshoty) do weryfikacji formalnej (Lean, TLA+). Pierwszy skill: **Control Glass** = (a) **CLI w katalogu skilla**, żeby agenci nie pisali za każdym razem własnych skryptów, „różnych między sesjami” (09:41); (b) **mapa funkcji** — „materializowana pamięć”: jakie funkcje ma aplikacja, jak użytkownik do nich dochodzi (skróty klawiszowe, elementy DOM), co robią; trzymana w katalogu skilla i **utrzymywana przez automatyzację** (11:08–11:42). Powód mapy: zgłoszenia ze Slacka z niejasnym zrzutem ekranu i „???” — agent umiał uruchomić aplikację, ale zgadywał, o co chodzi. Połączenie CLI + mapy stało się „krytyczną infrastrukturą zespołu” (12:15).
3. **Weryfikacja ≠ jakość** (12:41–14:49). Weryfikacja mówi, czy działa; o wydajności i jakości kodu mówią skille uczące inżynierskiej pracy (pstack) — repozytorium skilli zespołu, które budują doświadczeni inżynierowie.
4. **Najważniejsze: architektura przyjazna agentom** (14:55–22:46). „Kod bazy to najlepsza forma pamięci”, bo agenci rozszerzają wzorce, które widzą w kontekście. **Drabina egzekwowania, od najsilniejszej** (15:35–18:40, powtórzona jako slajd końcowy 36:11–37:13): (1) kod bazy i architektura — zły wzorzec **kategorycznie niemożliwy** przez struktury danych i układ; (2) analiza statyczna — reguły lint; (3) reguły, Bugbot, skille — „prowadzenie”, nie egzekwowanie: agent może zapomnieć przeczytać regułę; (4) przewodnik stylu — egzekwowany tylko przez człowieka w review, „wielka dziura” przy tej liczbie PR. Kolejność pracy: przy każdej korekcie agenta zapytaj, na którym szczeblu poprawka jest najskuteczniejsza, i zaczynaj od góry.
5. **Antywzorce rozchodzą się jak wirus** (20:43–21:32). Jedno obejście albo komentarz tłumaczący obejście — w ciągu dni lub tygodni agenci kopiują je wszędzie i staje się wzorcem de facto.
6. **Dune — framework przyjazny agentom** (18:53–30:37). Agenci lubią skróty, więc łatwa ścieżka ma być właściwą. Kod „zablokowany” — uciążliwy dla ludzi, idealny dla agentów z małym kontekstem (pilotowanych przez projektantów, PM-ów). **Zakaz komentarzy** (22:54–24:24): agenci używali komentarzy jako usprawiedliwienia, żeby nie rozwiązać problemu i przykleić plaster. **Granice wymuszane grafem importów** (27:38–29:13): kod procesu głównego Electrona nie może trafić do wątku renderującego — lekcja z problemów wydajności.
7. **Ogrodnik** (24:26–26:43). Każdy zespół potrzebuje roli ogrodnika: wyrywa chwasty, zanim się rozejdą. Trzy zasady: usuń istniejący dług techniczny; **jedna utwardzona ścieżka** dla wzorców, z prowadzeniem w kodzie, CI i lincie; na widok złego wzorca **najpierw reguła lint** („zatrzymaj krwawienie”), sprzątanie potem; kod ma być w stanie, który chętnie zobaczysz skopiowany przez agenta.
8. **Pętla zewnętrzna** (32:37–35:10). Bot podłączony do Slacka, Datadoga, Sentry; rutyny subskrybują wątki i alerty i same uruchamiają agentów chmurowych — automatyczne odtwarzanie zgłoszeń i otwieranie PR. „Mózg firmy” zbędny, agenci dobrze używają narzędzi.

**Relacja do naszej analizy.** Punkt 4 to ta sama teza, co nasz ETAP2 (reguły cicho pomijane — IFScale), POMIARY §1 (reguły `paths:` nie docierają przy `cat`) i mini-run (a) (wklejone działa, czekające w pliku bywa pomijane) — tylko z wnioskiem posuniętym dalej: nie „jak lepiej dostarczyć regułę”, ale „jak sprawić, żeby reguła była zbędna”. Nasz pipeline pracuje głównie na szczeblach 3 i 4 (coding-rules, learned-patterns, osie review, CodeRabbit); szczeble 1–2 są zaplanowane tylko częściowo (bramki §2a).

## 2. Kandydaci — przegląd

Klasy: **WEŹ** (tanie, zgodne z kierunkiem, niezależne od panelu), **PANEL** (otwarta decyzja albo wejście do kroku 0), **PÓŹNIEJ**, **NIE** (§4).

| ID | Źródło | Co to jest | Stan u nas | Klasa |
|---|---|---|---|---|
| A1 | pstack `principle-test-behavior-not-implementation`; Matt `tdd` | test „czy przeszedłby, gdyby każda importowana funkcja zwracała `undefined`” + 5 kształtów testu niefalsyfikowalnego | kryterium falsyfikowalności bez operacyjnej definicji; Stryker nie do każdego domknięcia | WEŹ |
| A2 | **wystąpienie 15:35–18:40, 36:11**; pstack `encode-lessons-in-structure`, `reflect` krok 4; Matt `retro` | **drabina egzekwowania**: lekcję kieruj na najwyższy możliwy szczebel (niemożliwe w kodzie → lint → reguła/skill → review) | compound dopisuje każdą lekcję tekstem (szczebel 3) | WEŹ |
| A3 | Matt `setup-ts-deep-modules` krok 6; pstack `create-verification-skill` krok 4 | bramka odebrana dopiero, gdy „gryzie” (przejście → podłożone naruszenie → porażka → przejście) | sposób odbioru bramek etapu 5 nieopisany | WEŹ |
| A4 | Matt `writing-for-agents` | negacja → cel pozytywny; kryterium ukończenia kroku; środowisko jako źródło prawdy; no-op sprawdzany uruchomieniem | 7 zasad warstwy stałej (§2a) bez tych czterech | WEŹ |
| A5 | pstack playbook `eval` | ślepa ewaluacja zmiany promptu | PA: „przed/po na historycznej fazie” | WEŹ (metoda etapu 5) |
| B1 | **wystąpienie 08:38–12:33**; pstack `create-/maintain-verification-skill` | skill weryfikacji z CLI + mapa funkcji utrzymywana automatycznie; przejście regresyjne | scenariusze E2E per zadanie; brak mapy i regresji | PANEL |
| B2 | Matt `retro` („Implementation vs Review”) | standardy egzekwuje reviewer, nie builder | coding-rules ładowane builderowi | PANEL |
| B3 | pstack `blast-radius` | poziom pewności dowodu 1–5 w findingu i werdykcie | sceptyk: DISAGREE_EVIDENCE = linia albo test | PANEL |
| B4 | pstack „the best spec is code”, `feature`; Matt `to-tickets`, `tdd` | lżejsza ścieżka planu dla małych zadań; szwy testowe w IU | scalenie planu = wymóg §2 pkt 12; PA-30 otwarte | PANEL |
| B5 | Matt `implement-spec`; pstack `autopilot-full` | równoległe IU w worktree | fazy sekwencyjne | PANEL — do odłożenia |
| B6 | **wystąpienie 27:38–29:13**; Matt `setup-ts-deep-modules` | granice warstw wymuszane grafem importów (dependency-cruiser) | coding-rules §14 to tekst | PANEL + decyzja operatora (zależność) |
| B7 | **wystąpienie 20:43–26:43**; Matt `improve-codebase-architecture` („co kilka dni”) | ogrodnik: okresowy przegląd projektu pod wzorce, które agenci kopiują; najpierw reguła lint, sprzątanie potem; jedna utwardzona ścieżka | brak; dev-compound-refresh dba o bazę wiedzy, nie o kod | PANEL / decyzja operatora |
| B8 | **wystąpienie 22:54–24:24**; pstack `no-comments` | komentarze jako nośnik obejść → zakaz albo lista dozwolonych | coding-rules bez zasady o komentarzach-uzasadnieniach; bot: 5/574 uwag o komentarzu niezgodnym z kodem | PÓŹNIEJ (obserwować) |
| C1 | pstack `references/bugbot-triage.md` | katalog odrzucanych wzorców bota z poziomem pewności + „zawsze pytaj” | dev-pr: 4 klasy + cytat; szum gaszony w `.coderabbit.yaml` | PÓŹNIEJ |
| C2 | pstack playbook `babysit` | porażka CI: klasyfikacja przed ponownym uruchomieniem; jedna tura = jeden push | dev-pr bez obsługi porażek CI | PÓŹNIEJ |
| C3 | pstack `show-me-your-work` | dziennik decyzji + „Attention” | telemetria + journal; „dlaczego” rozsiane | PÓŹNIEJ |
| C4 | pstack `opening-a-pr`; Matt `pr` | opis PR z ryzykiem i „drzwiami jednokierunkowymi” | opis bez sekcji ryzyka | PÓŹNIEJ |
| C5 | Matt `wizard` | skrypt prowadzący człowieka przez konta i sekrety | dev-prep: lista „Konta, konsole, sekrety” | PÓŹNIEJ |
| C6 | Matt `to-questionnaire` | ankieta dla klienta | dev-prep: pytania zamknięte | PÓŹNIEJ |

## 3. Szczegóły

### A1. Test niefalsyfikowalny — operacyjna definicja

- **Treść (pstack):** przed zatrzymaniem testu zapytaj, czy przeszedłby, gdyby każda funkcja, którą importuje, zwracała `undefined`. Pięć kształtów: słaba albo brak asercji (`toBeDefined`, `toBeTruthy`, `not.toThrow`, `toBeGreaterThan(0)`); tylko mock albo nieobecność (`toHaveBeenCalled`, `toEqual([])`); samoodniesienie; przypięta stała (test przepisuje konfigurację albo prompt); fixture sprawdza fixture. Naprawa: jedno konkretne wejście, dosłowny wynik albo obserwowalny skutek.
- **Dlaczego u nas:** ETAP2 — trzy warstwy testów niefalsyfikowalnych; Stryker 5–15 min na fazę NIE idzie do każdego domknięcia (§2a). Pytanie „undefined” to ręczna, darmowa wersja testu mutacyjnego.
- **Gdzie:** polecenie-lista osi test-coverage (ETAP1B §3) i jedno polecenie w warstwie stałej builderów; część mechaniczna (brak asercji, same słabe matchery) — reguły wtyczki vitest przy wdrażaniu bramek (szczebel 2 drabiny; nazwy reguł do potwierdzenia przy wdrożeniu).
- **Metryka:** uwagi B bota klasy „test” na 100 plików PR; findingi test-coverage obalone przez sceptyka.

### A2. Drabina egzekwowania — kierowanie lekcji na najwyższy szczebel

- **Treść:** wystąpienie (slajd końcowy): przy każdej korekcie agenta zapytaj, na którym szczeblu poprawka jest najskuteczniejsza — (1) niemożliwe w kodzie (typ, struktura danych, architektura), (2) lint/analiza statyczna, (3) reguła, skill, bot, (4) przewodnik stylu w review — i zaczynaj od góry. Matt (`retro`): naruszenie mechaniczne dostaje deterministyczną kontrolę „full stop”; plik standardów tylko na sprawy osądu. pstack (`reflect` krok 4): z przyjętych lekcji przenieś do backlogu wszystko, co pewniej wymusi mechanizm.
- **Dlaczego u nas:** compound dopisuje każdą lekcję tekstem do learned-patterns (szczebel 3; limit 50, dziś 47–49 tys. zn w oferty-online). Nasze pomiary potwierdzają słabość szczebla 3: `paths:` nie dociera przy `cat` (POMIARY §1), ETAP1: 45/68 ucieczek miało regułę. Pomiar 2 (lint trafia 1/97 uwag B) mówi, że większość obecnych lekcji jest osądowa — więc zmiana nie opróżni indeksu, ale zatrzyma w nim wpisy, które powinny być bramką albo typem.
- **Przykład (oferty-online, learned-patterns 38 wpisów / 50 167 B):** wpis „klucz limitera IP z adresu połączenia, `X-Forwarded-For` tylko od zaufanego proxy” → szczebel `lint` (nagłówek wolno czytać tylko w jednym wskazanym miejscu — dziś `app.ts:569` przekazuje go do logiki w `rate-limit.ts`; wszędzie indziej `no-restricted-syntax`); wpis „sumuj kolumnę pomiarową dopiero po sprawdzeniu rozłączności odcinków” → `regula` (osąd).
- **Gdzie:** compound (skill + `dev-compound-wf.js`, krok 5–6): przed zapisem reguły pole `szczebel: kod | lint | regula` z jednym zdaniem uzasadnienia; `kod` i `lint` → `propozycjeBramek[]` w raporcie (obok `propozycjeDoReviewerow[]`), decyzja operatora; do learned-patterns tylko `regula`. Przy przepisaniu compoundu w etapie 5 (frontmatter klasa/reguła/paths/waga — §2 pkt 4) to jedno pole więcej.
- **Metryka:** wpisy learned-patterns na zadanie; propozycje bramek i odsetek wdrożonych; powtórzenia tej samej klasy ucieczki po wdrożeniu bramki (słownik klas, §2a).

### A3. Bramka odebrana dopiero, gdy „gryzie”

- **Treść:** Matt: konfiguracja, która nie pada na naruszeniu, jest bezwartościowa — przejście na czystym przykładzie, podłożone naruszenie → porażka z konkretną regułą, cofnięcie → przejście. pstack: wygenerowany skill, którego nikt nie uruchomił, to szkic.
- **Dlaczego u nas:** etap 5 wprowadzi kilka bramek naraz (ESLint flat, knip, size-limit, `migrations.sum`, bramka niezmienności migracji, advisors, zielony main). Szablon miał już przypadek „mechanizm istniał, nie działał”: telemetria pokazywała `dossier: undefined` we wszystkich fazach (komentarz w `dev-autopilot-wf.js` przy obliczaniu dossier). Po A2 bramek przybywa z compoundu — tym bardziej potrzebny jednolity odbiór.
- **Gdzie:** zasada odbioru każdej bramki w planie etapu 5 + test w `.claude/workflows/__tests__` (albo w doctor) z podłożonym naruszeniem.
- **Metryka:** klasa KONFIGURACJA (1 faza): bramka ma test porażki = tak/nie.

### A4. Cztery zasady pisania z `writing-for-agents`

Do zasad warstwy stałej (PANEL-WEJSCIE §2a, dziś 7) i do checklisty cyklicznego prompt-auditu:
1. **Negacja przyciąga zakazane zachowanie** — pisz cel pozytywny; zakaz tylko jako twarda bariera, w parze z celem. Zgodne z pamięcią „skille mandatują akcje” (tryb rozkazujący zostaje, zmienia się przedmiot rozkazu). Dotyczy też coding-rules (decyzja operatora, PA-26).
2. **Każdy krok kończy się kryterium ukończenia** — jasnym i wymagającym; nieostre zaprasza do przedwczesnego zakończenia.
3. **Środowisko jest źródłem prawdy** — nie przepisuj do promptu `package.json`, konfiguracji ani `--help` (PA-13 „11 KB” to dokładnie ten przypadek); cache'uj tylko to, czego agent nie znajdzie patrząc.
4. **No-op rozstrzyga uruchomienie, nie dyskusja** — zgodne z metodą mini-runu.

### A5. Ślepa ewaluacja zmian promptów

Metoda do iteracji etapu 5 w obszarze „prompty maszynerii” (6a pkt 25): organiczne zadanie bez słów eval/test/judge/candidate w katalogach, plikach i prompcie; kandydaci nie wiedzą o sobie; sędzia widzi neutralne etykiety i ocenia oba warianty w jednym przebiegu; przestrzeganie łańcucha instrukcji oceniane z transkryptu (które pliki agent otworzył), nie z deklaracji. U nas uzasadnione dodatkowo przez N1. Zero kosztu w szablonie.

### B1. Skill weryfikacji z mapą funkcji (pierwszy filar wystąpienia)

- **Treść (wystąpienie + pstack):** CLI w katalogu skilla zamiast skryptów pisanych od nowa w każdej sesji (09:41); mapa funkcji jako „materializowana pamięć” — funkcje, droga użytkownika (skróty, elementy DOM), co robią — w katalogu skilla, utrzymywana automatyzacją (11:08–11:42); razem „krytyczna infrastruktura” (12:15). pstack rozpisuje to na sekcje: **Launch** (komenda i sygnał gotowości), **Doctor** („czy tę instancję warto prowadzić”), **Drive** (prawdziwe selektory z repo), **Evidence** (akcja + stan + efekty uboczne; dowody przeżywają sprzątanie), **Cleanup** (tylko to, co uruchomiłeś); generator raz przechodzi cały skill przed oddaniem; `maintain-verification-skill` — czytelnik źródła per funkcja + jedno przejście na żywo; wynik `clean | changed | blocked`; dryf opisu poprawia w mapie, regresję produktu zgłasza. Lane regresyjny (`autopilot-full`): ten sam scenariusz na trunku.
- **Stan u nas:** feature-tester-e2e odgrywa checkboxy `[E2E]` z pliku zadania; przepis na środowisko (`.env.e2e`, runner z re-seedem, port 5173, doctor agent-browser) rozsiany po agencie, workflowie review i skillach; scenariusze nie przeżywają zadania; brak przejścia po funkcjach nietkniętych planem. Przegląd runów: STOP-y E2E; 6a pkt 19: środowisko sprawdzone przed startem.
- **Co by to dało:** jedno źródło prawdy o uruchamianiu i prowadzeniu aplikacji (doctor/precheck z 6a pkt 19 dostaje gotową sekcję Doctor); mapa rośnie z każdym zadaniem (dev-docs-complete dopisuje funkcję), więc regresja = przejście po wpisach dotkniętych diffem; smoke operatora bierze pozycje z mapy. Przyszłościowo: mapa to warunek pętli zewnętrznej (zgłoszenie z Sentry → agent wie, gdzie jest funkcja) — dokładnie powód jej powstania w wystąpieniu.
- **Koszt dziś (`skrypty/insp_koszt_e2e.py` na `agents.csv`):** role E2E 198 wywołań = 4,7% kosztu runów; tester `review:e2e` 2,5% (p90 817 s), stawianie/sprzątanie środowiska (env-up, db-sync, precheck, env-down) 2,1%.
- **Ryzyka i koszt:** artefakt per projekt do utrzymania; przejście regresyjne wydłuża E2E w runie (ograniczyć do funkcji, których pliki dotyka diff); generator jednorazowo per projekt. Bez nowego agenta.
- **Dla panelu:** decyzja „architektura weryfikacji E2E”: (a) jak dziś + parametryzacja; (b) skill `verify-<app>` + mapa funkcji, tester czyta skill; (c) (b) + przejście regresyjne po funkcjach z diffu. Metryki: `faza.e2e` skip/manual/fail (§12), STOP-y E2E na run, uwagi bota i zgłoszenia Sentry w funkcjach nietkniętych przez plan.

### B2. Standardy u reviewera, nie u buildera

- **Treść (Matt `retro`):** implementer ma największą presję kontekstu; reviewer dostaje diff, więc to on narzuca standardy; plik standardów czytany w review. Wystąpienie idzie jeszcze dalej: i reviewer, i builder są na szczeblu 3 — docelowo standard ma się przenieść do kodu albo lintu (A2).
- **Za:** builder ~480–490 instrukcji po decyzjach (D2), coding-rules 117–130 z nich; mini-run (d): 400 vs 100 poleceń = ta sama jakość, +72% kosztu.
- **Przeciw:** ETAP1: 45/68 ucieczek miało regułę; D1: połowa findingów po fixie to przeoczenia rundy 1, a każdy finding to tura fixa; zapobieganie u buildera może być tańsze niż złapanie.
- **Dla panelu:** decyzja „rozkład reguł zachowaniowych builder ↔ reviewer” w warstwie referencyjnej (§2 pkt 3). Metryka: findingi P1/P2 na fazę, tury fixa, ctx_start buildera.

### B3. Poziom pewności dowodu

Skala z `blast-radius`: 1 „tak twierdzę”, 2 `plik:linia`, 3 przejście ścieżki błędu, 4 uruchomiony skrypt/test na prawdziwym kodzie, 5 odtworzone w aplikacji. Dla panelu: pole `dowod: 1–5` w schemacie findingu i werdyktu sceptyka, próg per waga (np. P1 ≥ 3; P1 potwierdzony ≥ 4 — test padający przed poprawką, co §2 pkt 7 już wymaga). Miara jakości findingów niezależna od liczby.

### B4. Plan lżejszy dla małych zadań + szwy testowe

pstack nie ma skilli planowania („najlepsza specyfikacja to kod”); `feature`: `how` → `architect` (kilka szkiców, w każdym najpierw użycie przez wywołującego) → punkt kontrolny równoległości → delegacja → weryfikacja. Matt `tdd`: testy tylko na szwach uzgodnionych przed pierwszym testem. Dla panelu, przy scalonym dev-plan+dev-docs (§2 pkt 12): (a) głębokość „Lekka” bliżej tego przebiegu (łączy się z PA-30); (b) pole „szwy testowe” w IU. SDD zostaje (operator: zasada do optymalizacji, nie do usunięcia).

### B5. Równoległe IU (do jawnego odłożenia)

Matt `implement-spec`: graf IU z „frontem”, implementerzy w worktree, merger; pstack `autopilot-full`: właściciel per PR. Wystąpienie: skalowanie w liczbie agentów dopiero PO zbudowaniu zaufania (06:25). U nas duża przebudowa autopilota i więcej procesów naraz (HANDOFF §1). Rekomendacja: opcja na przyszłość z warunkiem (telemetria pokaże, że czas ściany faz jest wąskim gardłem).

### B6. Granice warstw wymuszane grafem importów

- **Treść:** wystąpienie (27:38–29:13): w Dune kod procesu głównego nie może trafić do wątku renderującego — egzekwowane grafem importów, bo przypadkowe importy psuły płynność UI. Matt: dependency-cruiser z regułami „tylko przez punkt wejścia pakietu” i „zero cykli”, odebrany zasadą „prove it bites” (A3).
- **U nas:** coding-rules §14 („zero circular dependencies”, „komponent UI nie woła bazy bezpośrednio, idzie przez serwis/hook”) to szczebel 3; w planowanych bramkach tylko `import-x/order`. oferty-online (HEAD `1fb6ecd`): 5/88 plików `.tsx` dashboardu importuje klienta Supabase, w tym ekran zaproszenia woła `rpc` wprost; pozostałe to auth (3 × `signOut`, provider sesji) — `skrypty/insp_granice.py` → `dane/insp-granice.txt`. Warstwa danych vs UI w React/Supabase to bezpośredni odpowiednik main/renderer.
- **Dla panelu:** bramka granic w zestawie domknięcia fazy; nowa zależność deweloperska → decyzja operatora. Alternatywa bez nowej zależności: reguły `import-x/no-cycle` i `no-restricted-imports` (np. zakaz klienta Supabase w `src/components/**`) w już planowanym ESLint — tańsza, słabsza (bez reguł „tylko przez punkt wejścia”). Metryka: uwagi B bota klas architektury i warstw; findingi osi correctness/spec o wywołaniach bazy z UI.

### B7. Ogrodnik — okresowe odchwaszczanie wzorców, które agenci kopiują

- **Treść:** wystąpienie (20:43–26:43): kod bazy to pamięć agentów; antywzorzec albo komentarz-obejście rozchodzi się „jak wirus” w dni–tygodnie. Rola ogrodnika: usuń dług, trzymaj jedną utwardzoną ścieżkę na każdy wzorzec, na widok złego wzorca najpierw reguła lint („zatrzymaj krwawienie”), sprzątanie potem. Matt: `improve-codebase-architecture` „uruchamiaj co kilka dni” — przegląd pod pogłębienie modułów, raport, wybór jednego kandydata.
- **U nas:** nie ma nic, co patrzy na kod projektu między zadaniami. dev-compound-refresh dba o bazę wiedzy (szczebel 3), reviewerzy patrzą tylko na diff fazy; CodeRabbit tylko na PR. Obejście wprowadzone w zadaniu N wchodzi do dossier zadania N+1 jako „istniejący wzorzec”.
- **Kształt o niskim narzucie:** przegląd per projekt po zamknięciu zadania albo co N zadań (nie w każdej fazie): wyszukanie powtarzających się wzorców (obejścia, duplikaty, wyciszenia lintu, komentarze tłumaczące obejście) → lista z propozycją szczebla (A2): reguła lint teraz, sprzątanie jako osobne zadanie. Raport do operatora, zero zmian w kodzie bez decyzji. Może być skryptem (grep + ESLint) z jednym agentem do oceny, nie workflowem.
- **Dla panelu / operatora:** czy i jak często; gdzie w pipeline (dev-docs-complete, osobny skill); koszt (1 agent na przegląd). Metryka: liczba nowych reguł lint z przeglądu; wzrost liczby wyciszeń lintu / obejść w kodzie między przeglądami (skrypt).

### B8. Komentarze jako nośnik obejść (obserwować)

- **Treść:** wystąpienie (22:54–24:24): agenci traktowali komentarze wokół kodu jako usprawiedliwienie, żeby nie rozwiązywać problemu i przykleić plaster; Dune zakazuje komentarzy. pstack: agent Comment Sicko z listą wyjątków (licencja, zachowanie wymuszone przez zależność zewnętrzną, dokumentacja publicznego API, linki do zgłoszeń); zamiast komentarza zmiana kodu, typ, test albo lint.
- **Nasze dane:** w klasyfikacji 574 uwag bota 11 trafień heurystyki słownej, po przeczytaniu 5 to komentarz niezgodny z kodem (PR 2, 4, 7, 9, 16; P2 1, P3 3, koszyk A 1; `dane/insp-komentarze.txt`; pozostałe to parser komentarzy HTML i odpowiedzi bota). D1: 3 defekty „stara linia, przyczyna w fixie” i 3 rozjazdy CLAUDE.md — kłamiący opis obok zmienionego kodu to znany u nas mechanizm, ale rzadki w uwagach bota. Nie mamy danych, czy komentarze-obejścia są kopiowane (nikt tego nie mierzył).
- **Rekomendacja:** nie zakazywać teraz. Wziąć tańszy element: w przeglądzie ogrodnika (B7) komentarze tłumaczące obejście (`workaround`, `hack`, `tymczasowo`, `TODO`, wyciszenia lintu) jako jedna z kategorii do zliczenia. Zakaz dopiero, gdy liczby pokażą rozchodzenie się.

### C1–C6 (krótko)

- **C1** katalog odrzucanych wzorców bota z pewnością candidate/recurring/strong + „zawsze pytaj” (security, auth, dane, migracje, współbieżność) — po 8 zmianach `.coderabbit.yaml` i B0; szum lepiej gasić u źródła.
- **C2** porażka CI: flake = jedno świeże uruchomienie; identyczna druga porażka ≠ flake; porażka w kodzie nietkniętym = nieaktualna baza; poprawki jednej tury w jednym pushu.
- **C3** sekcja „Na co zwrócić uwagę” w raporcie dev-docs-complete z danych, które już są (MANUAL, SKIP, odłożone P3, known-issues).
- **C4** opis PR z sekcją ryzyka i „drzwiami jednokierunkowymi” (migracja, usunięcie danych).
- **C5** wizard: wykonywalna wersja sekcji „Konta, konsole, sekrety” z dev-prep; operator wpisuje sekrety we własnym terminalu.
- **C6** ankieta dla klienta z decyzjami [blokuje: planowanie] z dev-prep.

## 4. Czego nie bierzemy i dlaczego

- **Router `poteto-mode` z 23 playbookami i trybem „sticky”** — nasz przepływ to autopilot na Workflow; 7,5 tys. linii tekstu to odwrotność odchudzania. Samo wystąpienie mówi, że rdzeniem jest kod i weryfikacja, a skille to szczebel 3.
- **`interrogate` (wiele modeli)** — jeden dostawca; różnorodność daje CodeRabbit, „n próbek” jest w panelu. Z ramy sędziego do projektu sceptyka: „nitpick gravity” i „Act on > 5 = za słaby filtr”.
- **Osobny agent do komentarzy (Comment Sicko)** — koszt agenta; temat komentarzy prowadzimy przez B8/B7.
- **`shipping`, auto-merge, `patch-id`** — merge zostaje decyzją operatora.
- **`orchestrate`, `swarm`, `arena` jako skille** — rolę pełni Workflow.
- **Pętla zewnętrzna (Slack/Sentry → agent chmurowy → PR; wystąpienie 32:37–35:10, automatyzacja benny)** — poza pipeline'em dev-*; sensowna dopiero, gdy istnieje mapa funkcji (B1) i zaufanie do weryfikacji. Do zanotowania jako kierunek po etapie 5, nie teraz.
- **Weryfikacja formalna (Lean, TLA+)** — sama autorka mówi, że to otwarte pytanie i mało kto ją stosuje.
- **Konfiguracja modeli per rola (`setup-pstack`)** — potwierdza zasadę 7 z §2a; nic nowego.
- **Matt:** `handoff`/`claude-handoff` (mamy HANDOFF §8), `triage`/`wayfinder`/`to-spec` na trackerze, `teach`, `writing-*`, `scaffold-exercises`, `migrate-to-shoehorn`, `ask-matt`, `grill-with-docs` (odrzucony 2026-07), plugin (6a pkt 13), `diagnosing-bugs` (bugfix wypada, 6a pkt 20; jego idea „jedno polecenie, które już uruchomiłeś i które łapie ten błąd” jest w wymogu testu padającego przed poprawką P1, §2 pkt 7). `grilling` w rundach — zwykła synchronizacja `zroastuj-mnie` z upstreamem.

## 5. Co z tego dla panelu decyzyjnego (propozycja do kroku 0, po akceptacji)

- **Zasada przekrojowa (wejście do §2a):** drabina egzekwowania — każda zmiana, która dziś dodaje regułę tekstem, odpowiada najpierw, czy da się ją wyrazić wyżej (kod/typ, lint). Projekt panelu ocenia się także po tym, ile egzekucji przenosi ze szczebla 3–4 na 1–2.
- **Nowe otwarte decyzje:** architektura weryfikacji E2E (B1: a/b/c), rozkład reguł builder ↔ reviewer (B2), poziom pewności dowodu (B3), lekka ścieżka i szwy testowe (B4), bramka granic warstw (B6, wariant ESLint albo dependency-cruiser), ogrodnik (B7: czy, jak często, gdzie).
- **Do jawnego odłożenia:** równoległe IU (B5), pętla zewnętrzna (§4).
- **Wejścia do zasad:** A4 do §2a; A1 jako polecenie-lista test-coverage; A3 jako zasada odbioru bramek w planie etapu 5.
- **Poza panelem (PANEL-WEJSCIE §10):** A2 (compound), B8 jako kategoria w B7, C1–C6 według uznania operatora.

## 6. Kontrola

- Wystąpienie: każdy punkt §1 z minutą z transkrypcji; transkrypcja surowa (Whisper), więc cytuję sens, nie dosłowne brzmienie (np. „Potato”, „PSNAC”, „bug bot” = @poteto, pstack, Bugbot).
- Kandydaci sprawdzeni w plikach źródłowych (klony pod SHA z §0) i w naszym stanie: grep w `.claude/` (brak reguły „undefined” i kształtów testów poza coding-rules §2 o `toBeDefined`; dev-pr bez obsługi porażek CI; compound krok 6 bez szczebla; tester E2E czyta checkboxy z pliku zadania) i w PANEL-WEJSCIE §2/§2a/§10 (brak mapy funkcji, regresji, przeglądu kodu między zadaniami; `import-x/order` jako jedyna reguła importów).
- Liczby o naszym pipelinie z wcześniejszych domknięć (D2, mini-run (d), ETAP1, D1, pomiar 2); nowe liczby: `dane/insp-inwentarz.txt`, `dane/insp-komentarze.txt` (heurystyka 11 → czytanie 5).
- v1 → v2: każdy punkt v1 zachowany albo świadomie przesunięty (Comment Sicko z „nie bierzemy” → B8 z danymi); nic nie usunięte bez śladu.

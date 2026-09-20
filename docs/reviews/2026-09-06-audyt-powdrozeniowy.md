# Audyt powdrożeniowy 2026-09-06 — czy plan naprawy z 2026-09-03 zadziałał

Materiał: dwa pełne zadania przerobione po `/sync-template` na szablonie z commitów `cd1d0c0..5729d38`.

| Projekt | Zadanie | Fazy | Telemetria | Ślady w gicie |
|---|---|---|---|---|
| `oferty-online` | `faza-7-szablony-i-grafiki` | 6 | STOP 09-03 18:30 (9k) → STOP 09-04 16:49 (1136k) → **OK** 09-04 17:38 (217k) | 5× `fix(pr)`, 2× `stan pipeline'u po STOP`, 7× `kontrola diffu naprawczego` |
| `claude-cron` | `zalaczniki-w-skrzynce` | 4 | 3× STOP 09-03 → **OK** 09-03 22:03 (1376k) | 2× `fix(pr)`, 1× `stan pipeline'u po STOP`, 3× `kontrola diffu naprawczego` |

Baza porównawcza: 63 fazy historyczne z `~/.claude/telemetry/autopilot-runs.jsonl` (przed 2026-09-03)
kontra 10 faz nowych. Wszystkie liczby poniżej są liczone z telemetrii, `.autopilot-state.json`,
raportów `review-faza-N.md`, `git log` i GitHub API — nie z wrażeń.

---

## 1. Werdykt per pozycja

### Tura A

| Poz. | Werdykt | Dowód |
|---|---|---|
| **A1** — detektor blokera nie łapie findingów o kodzie | **działa** | Jedyny STOP `BLOKERZE SRODOWISKA` w obu runach (telemetria 2026-09-04 16:49, klasa `dev-server-nieosiagalny`) był realną awarią: `e2eSync` fazy 6 niezależnie stwierdza „port 5173 zajęty przez obcy projekt (`chatbot-cloudnest-widget`), `APP_ORIGIN http://app.localhost:3010` martwy". Zero fałszywych STOP-ów na defekcie kodu. |
| **A2** — STOP nie gubi wyników fazy | **działa** | Commit `257df3d` (`stan pipeline'u po STOP (faza 6)`): stan ma `metryki` dla 6/6 faz i **18 `otwarteFindingi`** fazy 6 (`liczniki: p1 0, p2 5, p3 13, operator 4`). Wpis telemetrii STOP ma `fazyZMetrykami: 6`, `liczniki` ≠ null. **Ale** — patrz znalezisko N2: świeży run te findingi porzuca. |
| **A3** — tester E2E nie startuje bez scenariuszy | **częściowo** | `e2eTryb: 'przegladarka'` przy `e2eCheckboxy: 0`: historycznie **7/15**, teraz **2/6**. Oba pozostałe (oferty fazy 1 i 3) to nowa, zamierzona ścieżka `figmaScreens` — ale ich wynik to `e2ePass/Fail/Skip = 0/0/0`, więc tester nadal startuje bez odgrywalnej pracy. |
| **A4** — `best-practices-researcher` sięga po Context7 | **niezweryfikowane** | Brak transkryptu `/dev-plan` z obu projektów. W definicji agenta Context7 jest (`.claude/agents/best-practices-researcher.md:72,78`), ale to dowód na intencję, nie na przebieg. |
| **A5** — jedna rodzina markerów blokera | **działa (ścieżka przepuszczenia)** | Jedna rodzina `[blokuje: planowanie]` / `[blokuje: faza N]` w `dev-prep`, `dev-plan`, `dev-docs`. W `oferty-online` bramka odroczyła pozycję fazy 6 do sekcji `## Blokery operatora per faza` w `plan.md:73` i przepuściła handoff — zgodnie z regułą dla N ≥ 2. Ścieżka STOP (`[blokuje: faza 1]`) nie została w tych runach tknięta → **niezweryfikowana**. |
| **A6** — commit WIP nie wciąga plików spoza zadania | **niezweryfikowane** | Zero commitów `wip(` w obu projektach od 2026-09-03 — `/dev-docs-update` nie był użyty ani razu. |
| **A7** — pojedynczy sceptyk nie zmienia wagi findingu | **działa, ale nie tak, jak plan każe mierzyć** | 5 śladów w treści raportów: `*(sceptyk sugerował P3 — utrzymane P2)*` — `oferty/review-faza-1.md:60`, `review-faza-4.md:81,97,105`, `claude-cron/review-faza-3.md:84,92`. Metryka `przebieg.severityKorekty.odrzucone`, na którą plan każe patrzeć, **nie istnieje w żadnym z trzech źródeł** → znalezisko N1. |
| **A8** — legacy `/dev-autopilot` usunięty | **działa** | Brak katalogu w szablonie. W obu projektach `.claude/skills/dev-autopilot/` istnieje, ale jest **pusty** — sync usunął `SKILL.md`, skill jest niewywoływalny. Zostały puste katalogi (N8). |
| **A9** — nieprawdziwe zdania w README | **częściowo** | README nadal opisuje roster sprzed B12 w trzech miejscach: linia 19 („architektura"), linia 49 („architektura, prostota"), linia 188 („rdzeń Security, Spec-compliance, **Simplicity**, Test-coverage; Performance / **Architecture** / **TypeScript** / E2E"). Realny roster: `security`, `performance`, `code-quality`, `correctness`, `spec-compliance`, `test-coverage`, `e2e` (`dev-docs-review-wf.js:362-368`). |

### Tura B

| Poz. | Werdykt | Dowód |
|---|---|---|
| **B1** — P3 typu KOD/TEST idą do fixa | **działa, mocno** | `fix.p3Pominiete` = 0 w 6 z 7 faz z pełnymi metrykami (1 w `claude-cron` fazie 4). `fix.naprawione` równa się sumie `p1+p2+p3` w 5 z 7 faz (np. `claude-cron` faza 1: 0+6+8 → 14 naprawionych). Raport `oferty/review-faza-4.md:118` ma jawny nagłówek „## Findingi P3 (KOD/TEST — idą do fixa)". Baza: historycznie zamkniętych P3 na zadanie 1/0/0/1/1/2/1. |
| **B1** — próg 1 (mediana `tokenyEtapy.fix`) | **w normie** | patrz rozdział 2. |
| **B2** — commit artefaktów przy zatrzymaniu | **działa** | 3 commity `stan pipeline'u po STOP` (oferty: `ce00d0c`, `257df3d`; claude-cron: `0fa9f92`). Po żadnym z nich w telemetrii **nie ma** STOP-a „niezacommitowane zmiany". Historycznie ten wzorzec: 6/39 runów. |
| **B3** — dossier fazy | **powstaje; efektu nie da się zmierzyć** | 10/10 plików: `/tmp/review-ctx-docs-active-<zadanie>-faza-N.md`, 29 914–57 305 B, timestampy zgodne z runami. Metryka `przebieg.dossier` nie istnieje → **próg 2 niemierzalny** (N1). Pośredni sygnał w rozdziale 2. |
| **B4** — sceptycy batchowani po pliku | **niezweryfikowane** | `przebieg.sceptycy.p2Grupy` i `p2Findingi` są liczone (`dev-docs-review-wf.js:1270`), ale nie trafiają ani do raportu, ani do stanu, ani do telemetrii (N1). |
| **B5** — sprawdzenie diffu naprawczego | **działa, mocno** | 7 z 10 faz ma `kontrolaFixa` ≠ null, wszystkie `walidacja: PASS`. Najmocniejszy dowód: `oferty` faza 5 — **61 pozycji, 55 naprawionych**, commit `60f1951` zdejmuje rzutowania `as` z kodu produkcyjnego (`isJsonRecord` zamiast `payload as Record<string, unknown>`) i z testów (schematy Zod zamiast deklaracji kształtu, produkcyjny `pino` na buforze zamiast atrapy). Bez B5 te 61 pozycji weszłoby do commita. |
| **B6** — brakujące domeny u reviewerów | **działa** | Wektory obejścia: `claude-cron/review-faza-3.md` P2/KOD `inbox-pull.mjs:110` — sekcja „Wektory obejścia bramki, żaden bez testu odmowy" z pięcioma wektorami i potwierdzeniem uruchomieniem renderu (źródło: security). §4/§13 u `code-quality`: `.claude/agents/kieran-typescript-reviewer.md:75,77` — `await` bez `catch` = P2, pusty `catch` = P2. |
| **B7** — osobny agent zgodności ze specyfikacją | **działa (cytaty); koszt niemierzalny** | `.claude/agents/spec-compliance-reviewer.md` istnieje, `spec-flow-analyzer` został dla `/dev-plan`. Findingi cytują ID wymagania: `claude-cron/review-faza-3.md` P1 — „IU-4 deklaruje, że dla odpowiedzi binarnych kontraktem jest status i długość". Porównanie z historycznymi 174k niewykonalne — telemetria nie rozbija `tokenyEtapy.review` per reviewer. |
| **B8** — plik zadań nie rośnie liniowo | **działa** | Sekcje „Do poprawy po review fazy N" zwinięte do jednej linii („Zamkniete cyklem fix: 12 pozycji — pełna treść w `review-faza-1.md`") w 6/6 faz `oferty` i 4/4 `claude-cron`. Niezaznaczone wiersze **zostały** w osobnej sekcji „Operator checklist faza N" (np. faza 5: 7 pozycji `- [ ] Operator:`). |
| **B9** — decyzje projektowe docierają do buildera | **częściowo** | Instrukcja jest: `dev-docs-execute-wf.js:148` każe skopiować do promptu blok „Decyzje przywolane przez to IU:". Brak transkryptów builderów → przebieg niezweryfikowany. |
| **B10** — plik kontekstu przestaje być drugim źródłem prawdy | **działa** | `claude-cron`: 4 sekcje (Źródła, Plan techniczny, Wymagania wstępne operatora, Dziennik). `oferty`: 5 — te same plus „Designerski kontekst" z toru Figmy. Zero sekcji „Decyzje techniczne", „Kluczowe pliki", „Odroczone do implementacji", „Wzorce do naśladowania" w obu. |
| **B11** — obalone findingi w raporcie | **działa** | Sekcja `## Obalone przez verify` w 10/10 raportach, **niepusta w 5** (claude-cron 2/4, oferty 3/6), mediana `obalone` = 1 na fazę. Obalenia są merytoryczne, nie proceduralne: obalenie findingu `correctness` o `drain: true` (`claude-cron/review-faza-3.md`) opiera się na reprodukcji na żywym serwerze („klient dostał `{status: 413, body: '{\"v\":1,\"error\":\"too_large\"}'}`, zero »fetch failed«"), a obalenie findingu `security` — na zmierzonym `duration_ms: 1006.5` istniejącego testu. |
| **B12** — konsolidacja reviewerów i oś poprawności | **działa; warunek odwrotu niespełniony** | patrz próg 3 w rozdziale 2. `correctness` produkuje findingi ze scenariuszem awarii, nie uwagi stylistyczne — jego finding o `drain: true` doczekał się obalenia przez eksperyment, co samo w sobie dowodzi, że był falsyfikowalną hipotezą o zachowaniu. |

### Tura C — `/dev-pr`

Wszystko sprawdzalne z GitHub API. PR-y: `oferty-online#8`, `#9`, `claude-cron#15` — wszystkie zmergowane.

| Sprawdzenie | Werdykt | Dowód |
|---|---|---|
| GraphQL `reviewThreads` zwraca wątki | **działa** | 23 (#8), 39 (#9), 17 (#15) wątków, wszystkie założone przez `coderabbitai`. |
| `addPullRequestReviewThreadReply` działa | **działa** | 36 odpowiedzi od `AIBiz-Automatyzacje` na #9, 13 na #15. Brak śladu fallbacku na REST. |
| PR ma niepusty opis | **działa** | 7 972 B (#8), 2 389 B (#9), 6 474 B (#15). Reguła „nigdy przez stdin" utrzymana. |
| `odrzuć` bez cytatu → `do-operatora` | **kod jest, przebieg niezweryfikowany** | `dev-pr-wf.js:278-286` przeklasyfikowuje w JS i loguje. Brak logu etapu `zbierz` z runów. |
| Żaden wątek rozwiązany bez zaadresowania | **działa** | 0 wątków `isResolved` bez odpowiedzi na #9 i #15. Nierozwiązane zostały nierozwiązane (6/23, 10/39, 4/17). |
| Compound zapisał klasy błędów, nie literówki | **działa** | `oferty`: `c2d6ddd` — 6 plików w `docs/solutions/` (skaner HTML regexpem, granica `try`, limity Storage, backfill przed unique index, testy o luźnym kształcie, React render/updater). `claude-cron`: `49dfcdb` — 3 klasy. `.claude/agents/` **nietknięte** przez pipeline w obu projektach (jedyne commity dotykające tego katalogu to sync szablonu i ręczna adaptacja E2E). |

---

## 2. Trzy progi alarmowe

### Próg 1 — mediana `tokenyEtapy.fix`

| | n | mediana | rozkład |
|---|---|---|---|
| historycznie | 34 | **34 k** | 0…185 k (plus jeden wpis `-2700`, patrz N6) |
| po zmianach | 7 | **75 k** | 45, 63, 63, 75, 105, 106, 110 |

Oczekiwanie planu: 60–80 k. Próg alarmowy: >120 k. **Wynik 75 k — w paśmie, akcja niepotrzebna.**
`LIMIT_P3_GLOBALNY` zostaje na 15.

Zastrzeżenie do próbki: fazy 1–3 `oferty-online` mają `zrodlo: "stan"` i `tokenyEtapy: null` — pochodzą
z runu, który padł, więc próbka to 7 z 10 faz.

### Próg 2 — efekt dossier

**Niemierzalny w sposób, który plan przewiduje.** `przebieg.dossier` nie istnieje w raporcie, stanie ani
telemetrii (N1), a czasu i liczby wywołań narzędzi reviewerów nikt nie zapisuje. Dostępne są tylko dwa
sygnały pośrednie:

| | n | mediana `tokenyEtapy.review` |
|---|---|---|
| historycznie | 36 | **233,5 k** |
| po zmianach | 7 | **182 k** (−22 %) |

Drugi sygnał: dossier realnie powstało dla **10/10** faz (pliki `/tmp/review-ctx-*.md`, 30–57 KB), więc
cichy fallback („dossier nie powstało, czytamy pełne dokumenty") na pewno nie zaszedł.

To nie jest dowód, którego żąda plan — spadek tokenów review może pochodzić z konsolidacji reviewerów
(B12) tak samo dobrze jak z dossier. **Rekomendacja: naprawić N1 przed następnym zadaniem, potem zmierzyć
ponownie.** Do tego czasu B3 zostaje „powstaje, efekt nieznany".

### Próg 3 — potwierdzone P1/P2 przez fazy

| | n faz | mediana P1+P2 | średnia | mediana P3 |
|---|---|---|---|---|
| historycznie | 63 | **4** | 4,38 | 11 |
| po zmianach | 10 | **6,5** | 7,20 | 8 |

**Wzrost o 63 %, nie spadek. Warunek odwrotu B12 niespełniony — konsolidacji nie cofamy.**

Rozbicie na typ (parser po nagłówkach raportów, 10/10 rozpoznanych): `oferty` 30 findingów P1/P2 typu KOD
w 6 fazach (5,0 na fazę), `claude-cron` 25 w 4 fazach (6,2 na fazę). Historyczne zadania w tych samych
repo dawały 0,5–2,4 na fazę, ale ta liczba jest **zaniżona** — parser rozpoznaje tylko część starych
formatów raportu (N5), więc porównanie po typie traktuję jako poszlakę, a rozstrzyga tabela wyżej.

Towarzyszący sygnał — dokładnie ten, który plan nazywa sukcesem:

| | mediana `znalezione` | `poDedupJs` | `poDedupSem` | `weryfikowane` |
|---|---|---|---|---|
| historycznie | 49 | 48 | **28** | 11 |
| po zmianach | 34,5 | 34 | **19,5** | 8 |

Mniej surowych findingów (−30 %), mniej po dedupie semantycznym (−30 %), a **więcej** potwierdzonych P1/P2.
To jest dokładnie „mniej duplikatów przy tej samej (tu: wyższej) wykrywalności".

---

## 3. Nowe znaleziska

Wyłącznie rzeczy widoczne w tych dwóch runach — nie powtórka audytu z 2026-09-02.

### N1 · P1 · `dev-docs-execute-wf.js` w szablonie się nie parsuje — ✅ NAPRAWIONE 2026-09-06

Szablon ma nieescapowany backtick w template literalu: `.claude/workflows/dev-docs-execute-wf.js:193`
— „`zmiany i decyzje tej fazy dopisz do sekcji ## Dziennik`". Pierwszy backtick zamyka literal i plik
przestaje być poprawnym ESM.

Dowód:

```
dev-autopilot-wf.js            OK
dev-docs-execute-wf.js         FAIL: Invalid or unexpected token
dev-docs-review-wf.js          OK
```

Fragment wszedł z B10 (commit `5775b79`, „plik kontekstu przestaje byc drugim zrodlem prawdy").
**Oba projekty trafiły na ten sam bug i naprawiły go lokalnie** — `claude-cron` `0e14f54` (2026-09-03 14:57,
zaraz po syncu `318b538`), `oferty-online` `356a412` (2026-09-04 08:22, po syncu `565e12f`). Szablon
nie został naprawiony.

Objaw jest mylący, bo plik leży na dysku i w manifeście, ale runtime go nie rejestruje: autopilot przechodzi
cały bootstrap i pada dopiero przy wejściu w fazę 1 na `workflow('dev-docs-execute-wf'): no workflow with
that name`. To wyjaśnia dwa STOP-y `claude-cron` z 2026-09-03 14:56 (3 k tokenów każdy).

**Każdy kolejny `/sync-template` w dowolnym projekcie skasuje lokalną naprawę i przywróci bug.**

**Wdrożone:**
1. Backtick zaescapowany (`dev-docs-execute-wf.js:193`).
2. `__tests__/skladnia-workflowow.test.mjs` — parsuje **każdy** workflow tak, jak robi to runtime
   (opakowanie w `async` + `new vm.Script`, bez wykonania). `node --check` się nie nadaje: workflowy mają
   `return` na górnym poziomie i dostałyby fałszywy FAIL. Test zweryfikowany negatywnie — po cofnięciu
   naprawy daje 2 FAIL, po przywróceniu 9 PASS.
3. Bramka w `sync-template.sh` **przed** apply: workflow ze źródła, który się nie parsuje, zatrzymuje
   sync (`exit 1`, wskazanie pliku), a projekt zostaje nietknięty. Fail-safe: brak `node` nie blokuje syncu.
   Przetestowane end-to-end na sztucznym szablonie — odmowa, happy path i tryb bez `node`.
4. Przy okazji: `cleanup()` w `sync-template.sh` biegnie z trapu EXIT, więc jego kod wyjścia nadpisywał
   kod skryptu — udany sync w trybie `TEMPLATE_LOCAL_SRC` zwracał `exit 1`. Bug pre-istniejący
   (potwierdzone na `HEAD`), dotyczył tylko ścieżki testowej, ale psuł testowalność bramki. Naprawiony
   przez `return 0`.

### N2 · P1 · Świeży run po STOP porzuca findingi poprzedniego review — ✅ NAPRAWIONE 2026-09-06

`oferty-online`, faza 6. Stan zapisany przy STOP (`257df3d`) niesie **18 otwartych findingów** i raport
`review-faza-6.md` o rozmiarze **21 096 B**: 5× P2 (KOD/TEST), 2× P2/OPERATOR, 13× P3 (11 KOD/TEST + 2 OPERATOR).

Świeży run z 17:38 powtórzył review od zera i zapisał raport o rozmiarze **8 457 B**: 5× P2, **0× P3,
0× OPERATOR**. Telemetria: `liczniki: {p1: 0, p2: 5, p3: 0, operator: 0}`, `fix.naprawione: 5`.

Jedenaście P3 typu KOD/TEST przepadło bezpowrotnie — grep po nazwach (`rate_limited`, `matchesEtag`,
`copy-button`, „tautologiczna") daje 0 trafień we wszystkich plikach zadania poza dwoma śladami w pliku
zadań. To dokładnie ta klasa findingów, którą B1 miał zacząć naprawiać.

Mechanizm: `dev-autopilot-wf.js:1222` przekazuje `poprzednieFindingi` do review-wf, ale review-wf używa
ich tylko jako kontekstu dla reviewerów (`dev-docs-review-wf.js:774` — i to **wyłącznie typu KOD**, TEST
odpada na filtrze), a `dev-autopilot-wf.js:1252` **nadpisuje** `faza.otwarteFindingi` wynikiem nowego review
bez żadnej unii. Reviewerzy przy powtórce po prostu nie znaleźli tych samych rzeczy — co przy 5 różnych
reviewerach i niedeterminizmie modelu jest oczekiwane, nie wyjątkowe.

Koszt zdarzenia: 79 k tokenów powtórzonego review plus utrata 15 findingów.

**Diagnoza pogłębiona przy wdrożeniu — to nie była jedna przyczyna, tylko trzy:**

**N2a — rozjazd schematu ze stanem (twardy bug, wcześniej nieopisany).** `otwartePoReview` od commita
`3007df4` (plan B1) przepuszcza findingi **P3** typu KOD/TEST, ale `FINDING_OTWARTY.severity` został na
`enum: ['P1','P2']` od `d30b8a2` — czyli sprzed planu naprawy. Stan idzie przez bootstrap-agenta ze
schematem `additionalProperties: false`, więc P3 są przy wznowieniu wymazywane. W jednym runie bug jest
niewidoczny (fix czyta findingi z pamięci, co zgadza się z danymi: `p3Pominiete` = 0), uderza **wyłącznie
przy wznowieniu między runami** — dokładnie w scenariuszu fazy 6. Dowód: stan po STOP zawiera 13 findingów
P3 w polu, którego schemat ich nie dopuszcza.

**N2b — `e2eTesterFail` nie utrwalał niczego.** Gałąź padu testera E2E robiła samo `zapiszStan()`, bez
ustawienia `otwarteFindingi` i `metryki`. Ta sama szkoda, którą A2 naprawił, ale **tylko** dla blokera
środowiska — pad testera kasował całą ocenę kodu.

**N2c — nadpisanie przy powtórce (pierwotna diagnoza).**

**Decyzja: unia, nie odzysk raportu.** Odzysk odpada, bo `review = pending` jest **celowe** — komentarz
w kodzie mówi wprost, że findingi E2E powstały na zepsutym środowisku i wymagają powtórki. Zasada, którą
przyjąłem: *powtarzamy ocenę środowiska, nie ocenę kodu.*

**Wdrożone:** `polaczFindingiPoPowtorce(nowe, poprzednie)` — findingi typu `E2E` z przerwanego podejścia
odpadają (tester wystawi świeży werdykt), reszta wraca oznaczona prefiksem
„[z przerwanego review tej fazy — potwierdź, czy nadal aktualny]". Podpięta w **trzech** miejscach
(bloker środowiska, `e2eTesterFail`, ścieżka normalna); `fixPrompt` dostał instrukcję, żeby przy takim
findingu najpierw sprawdzić w pliku, czy defekt nadal istnieje, i nie wymuszać zmiany, gdy zniknął.

Dedup jest **konserwatywny** — kluczem jest plik ORAZ treść. Przy samym pliku nie da się odróżnić „ten sam
defekt opisany inaczej" od „inny defekt w tym samym pliku", a rozstrzyga asymetria ryzyka: fałszywy dedup
to trwała utrata findingu (szkoda, którą naprawiamy), fałszywy duplikat to jeden defekt dwa razy na liście
fixa, naprawiony raz. W razie wątpliwości finding zostaje.

Testy: `__tests__/findingi-po-stopie.test.mjs` (8 przypadków) + `__tests__/metryki-w-stanie.test.mjs`
przypina kontrakt producent↔schemat, który złapał N2a.

### N3 · P2 · Metryki A7/B3/B4 nie istnieją poza żywym logiem — ✅ NAPRAWIONE 2026-09-06

Potrójna blokada, każda niezależna:

1. `dev-docs-review-wf.js:1256-1271` **produkuje** `dossier`, `severityKorekty`, `sceptycy`, `tiery`.
2. `przebiegBlok()` (`dev-docs-review-wf.js:621-641`) nie ma dla nich ani jednego wiersza — tabela
   `## Przebieg review` kończy się na „Adversarial verify".
3. `METRYKI_FAZY` (`dev-autopilot-wf.js:69-110`) ma `additionalProperties: false` i tych pól nie
   deklaruje — **stan by je odrzucił, nawet gdyby ktoś je podał**.
4. `skrotPrzebiegu()` (`dev-autopilot-wf.js:876-896`) przepisuje pole po polu i ich nie przepisuje.

Potwierdzone empirycznie: `przebieg` w `.autopilot-state.json` obu projektów ma dokładnie 13 kluczy,
żaden z czterech nie występuje; w telemetrii `dossier` jest `undefined` we wszystkich 10 fazach.

Skutek: **dwa z trzech progów alarmowych planu są dziś niemierzalne**, a A7 i B4 nie mają werdyktu
opartego na liczbie.

**Wdrożone we wszystkich trzech warstwach:** 4 wiersze w `przebiegBlok` (raport fazy), 4 pola
w `METRYKI_FAZY` — wszystkie **poza `required`**, żeby resume starszego zadania nie padło na walidacji —
i 4 linie w `skrotPrzebiegu` (stan + telemetria).

Dwa szczegóły, które wyszły przy wdrożeniu:
- `dossier` ma **trzy** stany, nie dwa. `false` = zmierzony cichy fallback (reviewerzy czytali pełne
  dokumenty), brak pola = nie mierzono. Pierwsza wersja renderowała brak pola jako „NIE — fallback",
  czyli oskarżałaby pipeline o coś, czego nikt nie zmierzył, i fałszowała próg 2 przy porównaniach.
- To samo w `skrotPrzebiegu`: brak metryki daje `null`, nigdy `0` — zero znaczyłoby „zmierzone i wyszło zero".

Od następnego zadania próg 2 i pozycje A7/B4 są mierzalne z telemetrii i widoczne w raporcie fazy.

### N4 · P2 · README opisuje nieistniejący roster reviewerów — ✅ NAPRAWIONE 2026-09-06

Trzy miejsca sprzeczne z `dev-docs-review-wf.js:362-368` i z linią 142 tego samego README:

- linia 19: „(bezpieczeństwo, wydajność, **architektura**, testy) … projekt bez ani jednego `.ts` nie płaci za **reviewera typów**"
- linia 49: „(bezpieczeństwo, wydajność, **architektura**, zgodność ze specyfikacją, **prostota**, testy)"
- linia 188: „rdzeń (Security, Spec-compliance, **Simplicity**, Test-coverage) … **Performance / Architecture / TypeScript** / E2E"

Reviewera typów, architektury i prostoty nie ma od B12 — są osiami wewnątrz `code-quality`. A9 poprawiał
README przed B12, więc te zdania przetrwały. Szacunek: **S**.

### N5 · P2 · Pięć konwencji nagłówka findingu w dziesięciu raportach — ✅ NAPRAWIONE 2026-09-06

Scribe zapisuje findingi w formacie, który zmienia się z fazy na fazę tego samego zadania:

| Konwencja | Gdzie |
|---|---|
| `#### 🔴 [P1/OPERATOR] \`plik\`` | oferty faza 1 |
| `#### 1. [P2 / KOD] \`plik\`` | oferty fazy 2, 5 |
| `### P2-1 · KOD · \`plik\`` | oferty faza 4 |
| `### P1 · KOD · \`plik\`` | claude-cron faza 3 |
| `#### 2. [KOD] \`plik\` — opis` pod `### 🟠 P2` | claude-cron faza 4 |

Zmienia się też nagłówek sekcji (`## Findingi` / `## Findingi P1` / `### 🔴 P1` / `## Findingi P3 (KOD/TEST
— idą do fixa)`) i format śladu sceptyka (`*(sceptyk sugerował P3 — utrzymane P2)*` vs `[sceptyk sugerował P3]`).

Skutek: każda agregacja przez fazy — także ta w tym audycie — wymaga ręcznego parsera z pięcioma regexami,
a i tak część starych raportów wypada. Metryki żyją w telemetrii, więc to nie blokuje pipeline'u, ale blokuje
tani przegląd „co ten pipeline znalazł przez ostatnie N faz".

Naprawa: jeden literalny wzorzec nagłówka w `scribePrompt` z przykładem „skopiuj dokładnie", zamiast opisu.
Szacunek: **S**.

### N6 · P3 · Telemetria: `e2eSync` zjada połowę wpisu, trzy linie są nieparsowalne — ✅ NAPRAWIONE 2026-09-06

`e2eSync` to swobodny tekst raportu agenta wklejany do JSONL: **3 335 B z 7 450 B (45 %)** wpisu z 2026-09-04
16:49, **1 712 B z 4 897 B (35 %)** wpisu z 17:38. Zawiera instrukcje dla operatora („UWAGA: Storage tego
projektu ODRZUCA nowy klucz `sb_secret_…` podany tylko jako `Authorization: Bearer`"), które są cenne — ale
w telemetrii, czyli w miejscu, którego operator nie czyta, a analiza nie potrzebuje.

Osobno: plik ma trzy uszkodzone linie — 10 (niezinterpolowane `'$TS'` / `'$PROJEKT'`), 28 (treść to komunikat
`jq: parse error: Unfinished string at EOF`) i 11 (`tokenyEtapy.fix: -2700`). Wszystkie **historyczne**
(sierpień), więc nie są regresją z 2026-09-03, ale każdy parser telemetrii musi być na nie odporny — ten
audyt musiał.

Naprawa: `e2eSync` skrócić do `{status, detal}` z twardym limitem (np. 300 znaków), pełny tekst zostaje
w logu i w raporcie fazy. Szacunek: **S**.

### N7 · P3 · Routing domenowy praktycznie nie przycina — ✅ NAPRAWIONE 2026-09-06

W 10 fazach routing pominął **wyłącznie** `e2e` (4× w `claude-cron`); w `oferty-online` **pełny skład
7 reviewerów w każdej z 6 faz**. Warunek `code-quality` (`dev-docs-review-wf.js:809`) to
`w.nowyModul || plikiKodu >= 3 || w.typowanie || plikiKodu > 0` — ostatni człon czyni go zawsze prawdziwym
dla fazy z kodem, co kod sam przyznaje w komentarzu. `correctness` ma `plikiKodu > 0`, `performance`
`(w.dane && plikiKodu > 0) || plikiKodu >= 5`.

To nie jest bug — to udokumentowana decyzja z B12 (zapis jawny, żeby rozdzielenie było mechaniczne).
Ale deklarowana w README oszczędność („projekt bez ani jednego `.ts` nie płaci za reviewera typów")
w praktyce nie zachodzi dla żadnej fazy dotykającej kodu. Warto to albo przyznać w dokumentacji (razem
z N4), albo wrócić do progów. Szacunek: **S** (dokumentacja) / **M** (progi).

### N8 · P3 · `/sync-template` zostawia puste katalogi po usuniętych skillach — ✅ NAPRAWIONE 2026-09-06

`.claude/skills/dev-autopilot/` istnieje w obu projektach i jest pusty (`total 0`). Skill jest
niewywoływalny, więc A8 zadziałał, ale katalog-widmo zostaje po każdym usunięciu ze szablonu.
Szacunek: **S**.

### N9 · P3 · `kontrolaFixa.walidacja: PASS` przy 55 z 61 naprawionych — ✅ NAPRAWIONE 2026-09-06

`oferty` faza 5: `kontrolaFixa: {pozycje: 61, naprawione: 55, walidacja: "PASS"}`. Commit `60f1951`
dokumentuje 4 świadomie zostawione rzutowania na granicy zewnętrznego SDK — czyli 6 nienaprawionych
minus 4 opisane = 2 bez śladu. Bramka nie odróżnia „naprawiono wszystko" od „naprawiono większość",
więc różnica nie ma gdzie wypłynąć. Szacunek: **S** (dopisać `pominiete[]` z uzasadnieniem, jak
`fix.p3Pominiete`).

---

## 4. Co wymaga decyzji operatora

**Wszystkie dziewięć znalezisk (N1–N9) wdrożone 2026-09-06** i wypchnięte na `origin/main`
w czterech commitach `83de0f9..e5ce4ea`: N1 · N2+N3+N6+N9 · N4+N5+N7 · N8. Zestaw testów szablonu:
**74/74 PASS**, sprawdzony na każdym commicie z osobna. Przy N7 wybrałem wariant dokumentacyjny
(README mówi prawdę o routingu), nie zmianę progów — próg 3 pokazał, że obecny skład reviewerów
podniósł wykrywalność, więc przycinanie go byłoby decyzją o koszcie, nie o jakości.

Otwarte zostają:

1. **Weryfikacja wdrożenia na realnym runie.** Wszystkie trzy naprawy mają testy, ale — dokładnie jak
   plan naprawy z 2026-09-03 — **żadna nie przeszła jeszcze przez run**. Pierwsze zadanie po tej zmianie
   powinno dać: `dossier`/`sceptycy`/`severityKorekty`/`tiery` w telemetrii i w raporcie fazy (próg 2
   staje się mierzalny), raporty `review-faza-N.md` w jednym formacie nagłówków, `kontrolaFixa.pominiete`
   i `bezSladu` w telemetrii, `e2eSync` ≤ 200 znaków w JSONL oraz — jeśli trafi się STOP — wpis w logu
   „Powtorka review: przenosze N finding(ow)".
2. **Otwarte decyzje z planu 2026-09-03, nadal otwarte:**
   - bramka `## Blokery operatora per faza` czytana przez autopilota przed fazą N — dowód, że dziś nikt
     jej nie czyta: pozycja `VITE_AA_MARKETING_URL` została niezaznaczona przez cały run i faza 6 przeszła;
   - dedykowany agent dla osi `correctness` zamiast `general-purpose` — oś się broni wynikiem, więc pytanie
     jest już tylko o koszt;
   - czy commitować `docs/reviews/` (ten raport, plan naprawy, prompty) — nadal nieśledzone;
   - parametryzacja toru E2E: ryzyko z planu **zrealizowało się** — `oferty-online` musiało przywrócić
     lokalne adaptacje po syncu (`a5e9b76`) i osobno naprawić sondę środowiska (`1de5a4c`,
     „sonduj srodowisko E2E po `.env.e2e`, nie po stalym porcie 5173").

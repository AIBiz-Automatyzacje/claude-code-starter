# Plan naprawy po audycie 2026-09-02

Źródło findingów: `docs/reviews/2026-09-02-audyt-pipeline.md`.
Status: **WDROŻONY W CAŁOŚCI 2026-09-03** — Tury A, B i C, commity `cd1d0c0..5729d38`
w `workspace-template`, jedna pozycja = jeden commit.
Pozostało: **weryfikacja na realnym projekcie** — patrz rozdział „Review wprowadzonych zmian" na końcu.

Ten dokument jest samowystarczalny — każda pozycja ma plik, kotwicę w kodzie, opis zmiany
i sposób weryfikacji. Nowa sesja nie musi wracać do raportu z audytu ani powtarzać analizy.

---

## Decyzje operatora

**Zatwierdzone do wdrożenia:** wszystkie findingi z etapów 1–5 raportu (bramki i STOP-y, koszt review,
fix i jakość, łańcuch dokumentów, luka po zadaniu) oraz usunięcie legacy skilla `/dev-autopilot`
z etapu 6.

**Rozstrzygnięcie w sprawie P3:** naprawiamy je w pipelinie. Uzasadnienie operatora: „bez sensu, że
potem je CodeRabbitem musimy poprawiać". To zmienia wariant z audytu — wchodzi wariant (a), nie
wyłączenie generowania.

**Nowa zdolność:** skill `/dev-pr` — obsługa pull requesta od wysłania do merge'a, z monitorowaniem
odpowiedzi CodeRabbita, decyzją co naprawiamy, turami poprawek i domknięciem przez compound.
Projekt własny, nie port z upstreamu (patrz Tura C).

**Odrzucone na teraz:** wszystkie nowe skille z upstreamów (`ce-resolve-pr-feedback`, `ce-babysit-pr`,
`ce-doc-review`, `wizard`, `ce-commit`, `ce-handoff`, `ce-commit-push-pr`, `ce-simplify-code`).
Zmiany metodologiczne wewnątrz naszych workflowów (dossier, tiery modeli) **nie są skillami** i zostają
w planie — pochodzą z etapu 2, który operator zatwierdził.

**Odłożone do osobnej decyzji:** pozostałe pozycje etapu 6 — parametryzacja toru E2E, hooki,
oś pomiaru w telemetrii, harness ewaluacyjny. Opisane na końcu dokumentu.

---

## Tura A — poprawki punktowe

Każda pozycja jest niezależna od pozostałych. Wszystkie mieszczą się w jednej sesji.

### A1. Detektor blokera środowiska łapie findingi o kodzie

**Plik:** `.claude/workflows/dev-docs-review-wf.js`

- **`:739-742`** — w `SYGNATURY_BLOKERA` usuń gołe `getaddrinfo` z drugiego wzorca. Docelowo:
  `/err_name_not_resolved|\benotfound\b|\beai_again\b|getaddrinfo\s+(enotfound|eai_again|eai_fail)|could not resolve host/i`.
  Pierwszy wzorzec (`dev-server-nieosiagalny`) zostaw bez zmian.
- **`:758`** — zawęź wejście: `wykryjBlokerSrodowiska(wszystkie.filter((f) => f._zrodlo === 'e2e'))`,
  i wołaj tylko przy `e2eTryb === 'przegladarka'` (w trybie `bez-przegladarki` odmowa połączenia
  z curla jest oczekiwana, nie jest awarią).
- **`:743-751`** — w `wykryjBlokerSrodowiska` dodaj warunek dodatkowy: bloker uznajemy tylko wtedy,
  gdy w `przebiegi[]` testera istnieje wpis FAIL lub SKIP. Bloker bez przebiegu to nie bloker.
  Sygnaturę funkcji rozszerz o przebiegi testera.

**Weryfikacja:** finding P2 z `docs/completed/faza-6-cta-i-webhooki/review-faza-3.md` (punkt 2,
o `dns.lookup` w `deliver.ts:214`) po zmianie **nie** może być klasyfikowany jako bloker. Dopisz
`.claude/workflows/__tests__/bloker-srodowiska.test.mjs` z 12 przypadkami: 6 pozytywnych (realne
komunikaty runtime) i 6 negatywnych, w tym ten finding dosłownie oraz `ECONNREFUSED` cytowany
w teście jednostkowym. README twierdzi, że taki test istnieje (`README.md:378`) — dziś nie istnieje.

### A2. Zatrzymanie na blokerze gubi wyniki fazy

**Plik:** `.claude/workflows/dev-autopilot-wf.js`, gałąź **`:993-1001`**

Przed `return await stopRun(...)` dopisz — dokładnie to, co robi ścieżka normalna w `:1031-1036`:

```
faza.otwarteFindingi = otwartePoReview(review.findings)
faza.metryki = { liczniki: policzFindingi(review.findings), przebieg: skrotPrzebiegu(review.przebieg) }
await zapiszStan()
```

`faza.review` **zostaje `pending`** — to jest celowe i nie zmieniamy tego: findingi E2E powstały na
zepsutym środowisku i po naprawie wymagają powtórki. Chodzi wyłącznie o to, żeby nie tracić metryk
i listy findingów kodu.

**Weryfikacja:** po STOP-ie na blokerze `.autopilot-state.json` ma wypełnione `metryki` i
`otwarteFindingi` dla tej fazy, a wpis w telemetrii ma liczniki zamiast `null`.

### A3. Tester E2E startuje bez scenariuszy

**Plik:** `.claude/workflows/dev-docs-review-wf.js`, **`:640`**

Zamień:

```
const domenaE2E = !warstwy || warstwy.ui || e2eCheckboxy > 0
```

na warunek oparty na policzonych checkboxach, z zachowaniem fail-open, gdy packager padł:

```
const e2eLiczbaZnana = !!warstwy && Number.isInteger(e2eCheckboxy)
const domenaE2E = !warstwy || (e2eLiczbaZnana ? e2eCheckboxy > 0 : warstwy.ui)
```

Uwaga: jeśli visual diff z makietami Figma ma działać w fazach bez checkboxów `[E2E]`, packager musi
zwrócić dodatkowo `figmaScreens: boolean` i warunek staje się alternatywą z tym polem. Sprawdź
`feature-tester-e2e.md` sekcja 3.5 przed wdrożeniem — jeśli visual diff jest zawsze podpięty pod
checkbox, dodatkowe pole jest zbędne.

**Weryfikacja:** w telemetrii nie powinny już występować wpisy `e2eTryb: 'przegladarka'` przy
`e2eCheckboxy: 0`. Historycznie było ich 10 na 18 uruchomień testera.

### A4. Agenci badawczy w `/dev-plan` uruchamiani jako `type: Explore`

**Plik:** `.claude/skills/dev-plan/SKILL.md`, linie **167, 168, 217, 218, 233**

Każde wystąpienie `Agent tool (type: Explore) z promptem z .claude/agents/<nazwa>.md` zamień na
`Agent tool, subagent_type: "<nazwa>"` i przekaż **wyłącznie podsumowanie kontekstu planowania**
jako prompt. Wzorzec poprawny jest w `dev-brainstorm/SKILL.md:108`.

Agenci: `repo-research-analyst`, `learnings-researcher`, `best-practices-researcher`,
`framework-docs-researcher`, `spec-flow-analyzer`.

Sprawdź też `dev-prep/SKILL.md:125` — jeśli jest tam alternatywa „Explore albo…", usuń Explore.

**Weryfikacja:** uruchom `/dev-plan` na dowolnym dokumencie wymagań i potwierdź w transkrypcie, że
`best-practices-researcher` sięgnął po Context7. Jeśli nie ma dostępu do narzędzi, dopisz `tools:`
w jego frontmatterze.

### A5. Trzy różne markery blokera operatora

**Pliki:** `dev-prep/SKILL.md`, `dev-plan/SKILL.md`, `dev-docs/SKILL.md`

Dziś: `dev-prep` emituje `[blokuje planowanie]` (`:137, :198, :233, :246, :252`), `dev-plan` dopisuje
`— blokuje Fazę N (IU-x)` (`:491, :610, :787`), a `dev-docs:140` szuka `[blokuje start]`. Bramka
gotowości nigdy nie zadziałała: w `oferty-online` 5 z 7 checklist nie zawiera markera, którego szuka.

Ujednolicenie na jedną rodzinę:

- `[blokuje: planowanie]` — pozycja, bez której `/dev-plan` nie napisze jednostek implementacyjnych
- `[blokuje: faza N]` — pozycja blokująca konkretną fazę; `dev-plan` **zmienia** marker przy
  dopisywaniu numeru fazy, nie dopisuje nawiasu obok starego

`dev-docs` Faza 5 punkt 2: grep `^- \[ \].*\[blokuje:` na pliku wskazanym przez `operator_prep`.
Pozycja blokująca fazę 1 albo bez numeru → **STOP** (nie uruchamiaj Workflow, tak samo jak przy
brudnym drzewie). Pozostałe → wpisz do `plan.md` pod nagłówkiem `## Blokery operatora per faza`.

Opcjonalnie, jeśli starczy czasu: w bootstrapie autopilota przed fazą N sprawdź tę sekcję i zatrzymaj
run, gdy pozycja blokująca fazę N jest nadal nieodhaczona.

**Weryfikacja:** `grep -rn "blokuje" .claude/skills/dev-*/SKILL.md` pokazuje wyłącznie nową rodzinę.

### A6. `dev-docs-update` dodaje wszystko do commita WIP

**Plik:** `.claude/skills/dev-docs-update/SKILL.md`, **`:16-20`**

`git add .` zamień na `git add -u` plus jawne wylistowanie plików nieśledzonych po `git status --short`,
z decyzją per plik. To jedyne miejsce w szablonie łamiące regułę powtórzoną w czterech innych plikach
(`execute-wf:178`, `autopilot-wf:1222`, `compound-wf:64`, `complete-wf:162`).

### A7. Pojedynczy sceptyk zmienia wagę findingu

**Plik:** `.claude/workflows/dev-docs-review-wf.js`, **`:897-903`**

Komentarz mówi, że pojedynczy głos nie może zdegradować P1 ani awansować P2. Kod tego nie robi:
przy jednym głosie `ileGlosow > glosy.length / 2` daje `1 > 0.5`, czyli korekta przechodzi. P2 ma
z definicji jednego sceptyka (`:878`), więc dotyczy to każdego findingu ważnego.

Zmiana: gdy `glosy.length === 1`, ignoruj `severityKorekta` i dopisz ją do opisu jako
`[sceptyk sugeruje <X>]`. Dodaj licznik `severityKorekty` do obiektu `przebieg`, żeby było widać,
jak często to się dzieje.

### A8. Usunięcie legacy skilla `/dev-autopilot`

**Katalog:** `.claude/skills/dev-autopilot/` (501 linii)

Usuń w całości. Uzasadnienie: opisuje 5 agentów review, `MAX_FIX_CYKLI: 2`, „Agent 4/5", pełne
powtórzenie review w pętli i deklarację „nie wymaga żadnego pliku stanu" — wszystko sprzeczne
z `dev-autopilot-wf.js`. Ma aktywne triggery w opisie, więc model może po niego sięgnąć zamiast
po workflow.

Posprzątaj referencje: `README.md:230` (wiersz o legacy fallbacku) i każde inne wystąpienie
z `grep -rn "skills/dev-autopilot" .`.

**Uwaga o kolejności:** zrób to **przed** A9, bo ten plik jest jednym ze źródeł wystąpień `5173`
i zmniejszy zakres tamtej pozycji.

### A9. Nieprawdziwe zdania w README

**Plik:** `README.md`

- **`:138` i `:140`** — opisują detekcję blokera jako działającą „w findingach E2E". Do A1 to
  nieprawda; po A1 stanie się prawdą. Zaktualizuj opis tak, by odpowiadał nowej implementacji
  (filtr po źródle, wymóg wpisu FAIL w przebiegu).
- **`:378`** — „regexy pokryte testem 12 przypadków". Test nie istnieje. Zdanie zostaje dopiero
  po dopisaniu pliku testowego z A1.
- **`:18-19` i `:47`** — „każdą fazę przegląda 8 niezależnych agentów-reviewerów". Routing bywa
  węższy (na 77 faz: `typescript` pominięty 11×, `e2e` 12×, `architecture` 4×, `performance` 2×).
  Zmień na „do 8 reviewerów, skład zależny od domeny fazy".
- **`:205`** — „preładowane do odpowiednich builderów/reviewerów". Pole `skills:` mają wyłącznie
  trzej buildery i tester; reviewerzy nie mają go wcale. Popraw na „preładowane do builderów".
- **`:214-215`** — `code-review` i `code-quality` są w tabeli skilli technicznych, a nie są używane
  nigdzie w pipelinie (`grep` w agentach, workflowach i skillach `dev-*` daje zero trafień).
  Przenieś do skilli narzędziowych z adnotacją „ręcznie, poza pipeline".
- **`.claude/docs/dev-pipeline.md`** — plik-zaślepka (3 linie „Dokumentacja przeniesiona"). Usuń.

---

## Tura B — zmiany zachowania pipeline'u

Te pozycje zmieniają to, co pipeline robi, więc warto je wdrażać pojedynczo i obserwować
kolejny run.

### B1. Naprawa findingów P3 — decyzja operatora

To jest zmiana, o którą prosił operator. Wymaga trzech spójnych ruchów, bo dziś P3 są odcinane
w trzech miejscach.

**1. `dev-autopilot-wf.js:662-666`** — `otwartePoReview` filtruje do P1/P2. Rozszerz o P3, ale
tylko te, które da się naprawić:

```
.filter((f) => f.typ !== 'OPERATOR' && (
  f.severity === 'P1' || f.severity === 'P2' ||
  (f.severity === 'P3' && (f.typ === 'KOD' || f.typ === 'TEST'))
))
```

P3 typu OPERATOR zostają poza fixem — to warunki środowiskowe, nie kod.

**2. `dev-autopilot-wf.js:505`** — zdanie „Napraw WSZYSTKIE z listy (sa to P1 blocking i P2 important;
P3 nie ma na liscie)" jest teraz nieprawdziwe. Zastąp instrukcją z kolejnością pracy: najpierw P1,
potem P2, na końcu P3; przy P3 obowiązuje zasada „napraw albo uzasadnij jednym zdaniem, dlaczego nie" —
i to uzasadnienie wraca w `FIX_RESULT`, żeby nie zniknęło po cichu.

**3. `dev-docs-review-wf.js:112`** — `LIMIT_P3_GLOBALNY = 8` był progiem dla nitów, których nikt nie
naprawiał. Skoro wchodzą do fixa, limit zaczyna wyrzucać pracę do zrobienia. Podnieś do **15**
i zmień kryterium wyboru w `wybierzNity` (`:844`): najpierw P3, których plik jest już na liście
P1/P2 tej fazy (agent i tak go otworzy), potem round-robin po źródle jak dziś.

**4. `dev-docs-review-wf.js:503-528`** (`scribePrompt`) — P3 trafiają teraz do sekcji „Do poprawy",
więc ich opis musi być wykonywalny: `plik:linia` plus jedno zdanie akcji. Bez tego fix dostanie
listę życzeń. Zaostrz to w `BLOK_LIMIT_P3` (`:58`): P3 bez konkretnej akcji w jednym pliku nie jest
findingiem i nie należy go zgłaszać.

**Czego nie zmieniamy:** severity gate. P3 nadal nie blokuje przejścia do następnej fazy — gdyby
blokował, jeden nit zatrzymywałby run.

**Spodziewany koszt:** mediana etapu fix rośnie z 34k do około 60–80k tokenów na fazę. Przy medianie
review 236k to nadal tania zmiana. **Zmierz to po dwóch zadaniach** — jeśli fix przekroczy 120k,
wróć do limitu 8 albo zawęź P3 do typu KOD.

### B2. Commit artefaktów przy zatrzymaniu

**Plik:** `.claude/workflows/dev-autopilot-wf.js`

Najczęstszy STOP w telemetrii (6 na 39 runów) to „niezacommitowane zmiany", zawsze bezpośrednio po
innym zatrzymaniu — bo `zapiszStan()` (`:827-843`) tylko zapisuje plik, a scribe zapisuje raport bez
commita. Dwie możliwe drogi, do wyboru przy wdrożeniu:

- **Prostsza:** w `stopRun` (`:792`) przed zwróceniem wyniku wykonaj commit jawnym pathspecem
  `docs/active/<zadanie>/` z komunikatem `docs(<zadanie>): stan pipeline'u po STOP (faza N)`.
  Kod fazy zostaje nietknięty, a lista brudnych plików spoza tego katalogu idzie do pola `powod`.
- **Alternatywna:** bramka `:814` uznaje drzewo za brudne tylko wtedy, gdy `git status --short`
  pokazuje ścieżki **spoza** `docs/active/<zadanie>/`, a bootstrap sam commituje artefakty.

Rekomendacja: pierwsza. Jest jawna i nie zmienia semantyki bramki czystości, która chroni przed
uruchomieniem autopilota na cudzych zmianach.

### B3. Dossier fazy zamiast pełnych dokumentów

**Plik:** `.claude/workflows/dev-docs-review-wf.js`

Największa pojedyncza pozycja kosztowa. Dziś `reviewerPrompt:369` każe **każdemu** reviewerowi
przeczytać dokument wymagań (63 KB), plan techniczny (76 KB) i `learned-patterns.md` (11 KB).

Zmiana: packager (`kontekstPrompt:343`, który i tak czyta wszystko) zapisuje **drugi artefakt** obok
zrzutu diffu — `/tmp/review-ctx-<zadanie>-faza-N.md` — zawierający:

1. sekcję `### Faza N` z planu technicznego (cięcie po nagłówku, `grep -n` + `Read` z offsetem)
2. wiersze tabeli „Śledzenie wymagań" przywołane przez jednostki tej fazy
3. `learned-patterns.md` w całości (11 KB, i tak potrzebne)
4. sekcję fazy z pliku zadań plus pole `figma_screens` z pliku kontekstu

Schemat `KONTEKST` (`:251`) dostaje pole `ctxPlik` analogiczne do `diffPlik`. `mapaBlok` (`:322`)
wskazuje oba pliki. `reviewerPrompt:369` zmienia się na: „przeczytaj plik kontekstu fazy; pełny plan
i dokument wymagań otwieraj **tylko** wtedy, gdy jednostka odsyła do czegoś, czego tam nie ma".

Ten sam plik podaj testerowi E2E (`e2ePrompt:403`) i sceptykom (B4).

**Weryfikacja:** porównaj czas i liczbę wywołań narzędzi reviewerów przed i po zmianie. Uwaga: sam
spadek tokenów wyjściowych tego nie pokaże, bo oszczędność jest po stronie wejścia.

### B4. Sceptycy batchowani po pliku i tańsze tiery

**Plik:** `.claude/workflows/dev-docs-review-wf.js`, **`:874-907`**

- P2 grupowane po ścieżce pliku (bez numeru linii), maksymalnie 4 findingi na grupę. Jeden sceptyk
  na grupę, prompt „obal każdy z poniższych osobno; brak dowodu przeciw jednemu nie obala drugiego",
  schemat `{werdykty: [{indeks, realny, uzasadnienie, severityKorekta}]}`. Brak wpisu dla indeksu =
  niezweryfikowany, jak dziś przy zerze głosów.
- P1 **bez zmian**: trzej niezależni sceptycy, konsensus 2 z 3.
- Do promptu sceptyka dołóż `mapaBlok(kontekst)` — dziś sceptyk nie ma gotowego diffu i sam odpala
  wyszukiwanie.
- Tiery: `effort: 'low'` dla packagera, `effort: 'medium'` dla sceptyków P2. Reviewerzy i sceptycy P1
  zostają na tierze sesji. Wystaw to jako `args.tiery`, żeby dało się porównać dwa ustawienia bez
  edycji kodu.

### B5. Sprawdzenie diffu naprawczego

**Plik:** `.claude/workflows/dev-autopilot-wf.js`, po commicie fixa

Dwustopniowo:

1. **Deterministycznie, zero tokenów:** grep na `git diff <feat>..<fix>` pod wzorce z `coding-rules`:
   `catch\s*\{\s*\}`, `catch\s*\(\w+\)\s*\{\s*\}`, ` as ` poza `as const`, `: any`, `console.log`,
   non-null `!`. Trafienie wraca do fixa z listą.
2. **Jeden tani agent:** instrukcja jak w `rereviewBlok` punkt 2 („zgłoś wyłącznie regresję
   wprowadzoną przez commit fix"), plus obowiązek: dla każdej **nowej bramki walidacyjnej** w diffie
   wypisz 3 wektory obejścia i sprawdź, czy istnieje test odmowy. Brak testu = P2 wracające do fixa,
   maksymalnie jeden cykl.

Uzasadnienie z dowodu: fix fazy 5 dodał `loading="lazy"` do ramki i pusty `catch`; jedno i drugie
CodeRabbit usunął dzień później (`44a938e`).

### B6. Brakujące domeny u reviewerów

**Pliki:** `.claude/agents/security-sentinel.md`, `.claude/agents/kieran-typescript-reviewer.md`

- **security-sentinel** — sekcja „Tryb atakującego (obowiązkowa)": dla każdej nowej bramki
  walidacyjnej (wyrażenie regularne, allowlista, limit rozmiaru, porównanie originu) wypisz co
  najmniej 5 wektorów obejścia z listy: encje HTML, adres protokołowo-względny `//`, wielkość liter
  schematu, białe znaki w URL, atrybuty bez cudzysłowu, listy wartości (`srcset`, przecinek),
  kodowanie porcjowe kontra `Content-Length`, IPv6 w nawiasach, port domyślny kontra jawny. Każdy
  bez testu odmowy = finding typu TEST. Plus checklista nagłówków dla każdego nowego originu.
- **kieran-typescript-reviewer** — checklista z `coding-rules` §4 i §13: `await`/`.then` w handlerze
  zdarzenia bez `catch`/`finally` → P2; klient HTTP lub Supabase bez limitu czasu → P2; pusty `catch`
  → P2; więcej niż jeden boolean stanu ładowania → P3.

Wsparcie deterministyczne: packager robi pre-skan (`catch\s*\{\s*\}`, `\.then\(` bez `\.catch\(`
w tym samym pliku) i podaje wynik jako listę w mapie zmian.

### B7. Osobny agent zgodności ze specyfikacją

**Nowy plik:** `.claude/agents/spec-compliance-reviewer.md` (po polsku, ok. 60 linii)

`spec-flow-analyzer` jest zaprojektowany do analizy specyfikacji **przed** implementacją, a
`review-wf:299` używa go po. To najdroższy reviewer w zestawie (mediana 174k tokenów, 295 s).

Procedura nowego agenta: (1) wczytaj jednostki fazy z planu i dossier, (2) dla każdego wymagania
znajdź implementację w diffie, (3) klasyfikuj: brak lub częściowa = P1/P2 KOD, scope creep = P2/P3,
błędna implementacja = P1, (4) wykonaj blok semantyki jednostek pól.

Podmień `agentType` w `:299`. `spec-flow-analyzer` zostaje wyłącznie dla `/dev-plan`.
Zaktualizuj `README.md:252`.

### B8. Planner czyta całe dokumenty

**Plik:** `.claude/workflows/dev-docs-execute-wf.js`, **`:112-125`** (`plannerPrompt`)

Zamiast czterech pełnych dokumentów (120–175 KB): tabela `## Fazy` i `## Źródła` z `plan.md`,
blok od `## Faza N` do następnego nagłówka z pliku zadań, sekcja `## Designerski kontekst` z pliku
kontekstu, sekcja `### Faza N` z planu technicznego. Wszędzie `grep -n` nagłówka plus `Read`
z offsetem i limitem.

Dodatkowo w `dev-autopilot-wf.js`: po `fix = done` fazy K zwiń sekcję „Do poprawy po review fazy K"
w pliku zadań do jednej linii ze wskaźnikiem do raportu. Pełna treść i tak jest w `review-faza-K.md`,
a plik zadań rośnie z 23 KB do 59 KB w trakcie jednego zadania i jest czytany przy każdej fazie.

### B9. Decyzje projektowe nie docierają do buildera

**Pliki:** `.claude/skills/dev-plan/SKILL.md` (sekcja 3.4), `.claude/workflows/dev-docs-execute-wf.js`
(`plannerPrompt`, punkt 5)

Jednostki implementacyjne odwołują się do decyzji po identyfikatorze („strażnik regresji D2") i do
punktów checklisty po numerze („teksty verbatim z sekcji 3.1"), bez treści. Builder fazy 6 sam
odnalazł plik checklisty i zostawił o tym komentarz w kodzie (`cta-section.ts:26`).

Zmiana: `dev-plan` przy każdym odwołaniu do decyzji dopisuje jedno zdanie jej treści, a zatwierdzone
teksty wkleja do jednostki dosłownie w bloku „Teksty (verbatim)". Planner dołącza definicje decyzji,
do których jednostka się odwołuje, skopiowane z sekcji kluczowych decyzji.

### B10. Plik kontekstu jako drugie źródło prawdy

**Plik:** `.claude/skills/dev-docs/SKILL.md`, Faza 3 (**`:106-126`**)

Z siedmiu sekcji workflowy używają dwóch: „Designerski kontekst" (`execute-wf:137`) i „Dziennik"
(`:176`). Sekcja „Decyzje techniczne" ma 1 linię wspólną z planem na 23, „Odroczone" 0 na 10 — to
przepisanie, nie kopia, utrzymywane ręcznie.

Nowy skład pliku kontekstu: `## Źródła`, `## Designerski kontekst` (bez zmian), `## Wymagania wstępne
operatora` (link plus lista nieodhaczonych z numerem fazy), `## Dziennik`. Sekcje „Kluczowe pliki",
„Decyzje techniczne", „Odroczone", „Wzorce" zastępuje jedna linia ze wskaźnikiem do planu.

`dev-docs-update` §1: decyzje sesji zapisuj wyłącznie w Dzienniku, korekty planu w `docs/plans/`.

### B11. Obalone findingi w raporcie

**Plik:** `.claude/workflows/dev-docs-review-wf.js`, po **`:909`**

Zbierz obalone (`!f.potwierdzony`) z uzasadnieniem sceptyka i przekaż scribe'owi. Scribe dopisuje do
`review-faza-N.md` sekcję „Obalone przez verify (nie do naprawy)" — jedna linia na finding. Do pliku
zadań **nie**. Koszt zerowy, dane już są w pamięci procesu.

Po trzech–pięciu zadaniach da się porównać tę listę z uwagami CodeRabbita i dopiero wtedy ocenić,
czy trzej sceptycy dla P1 są warci swojej ceny.

### B12. Konsolidacja reviewerów i oś poprawności

**Plik:** `.claude/workflows/dev-docs-review-wf.js`, **`:292-301`**

**To najbardziej ryzykowna pozycja w planie — wdrażaj ją ostatnią i osobno.**

Trzy wpisy (`architecture`, `simplicity`, `typescript`) zastąp jednym `code-quality`
(`agentType: 'architecture-strategist'`) z fokusem obejmującym granice warstw i SOLID, YAGNI
i martwy kod oraz bezpieczeństwo typów. Warunek routingu = alternatywa dotychczasowych trzech.

Zwolnione miejsce oddaj brakującej osi **correctness**: „prześledź wykonanie zmienionych ścieżek
i znajdź defekt, który tam jest" — dziś nikt nie ma tego zadania wprost.

**Warunek odwrotu:** mierz `poDedupSem` oraz liczbę potwierdzonych P1/P2 typu KOD przez 5 faz.
Jeśli liczba potwierdzonych spadnie, rozdziel z powrotem.

---

## Tura C — nowy skill `/dev-pr`

Domyka pipeline od wysłania pull requesta do merge'a. Dziś ten odcinek jest poza szablonem:
w `oferty-online` to 127 komentarzy bota w 6 pull requestach, 14 commitów ręcznych tur i zero
wpisów w bazie wiedzy.

### Kształt

**Skill** `.claude/skills/dev-pr/SKILL.md` prowadzi rozmowę i decyzje (tylko główna konwersacja
może zapytać operatora przez `AskUserQuestion`). **Workflow** `.claude/workflows/dev-pr-wf.js`
wykonuje jedną turę pracy, z bramkami w kodzie. Skill woła workflow raz na turę.

Podział ról jest ten sam co w `dev-docs-execute` i `dev-docs-review`: mechanika w JS, decyzje
w skillu.

### Tryby

- `/dev-pr` — **interaktywny**. Po każdej klasyfikacji operator wybiera przez `AskUserQuestion`
  (multiSelect), co naprawiamy w tej turze. Merge zawsze zostaje decyzją operatora.
- `/dev-pr 3` — **autonomiczny, do 3 tur**. Skill sam wybiera, co naprawić, według rubryki niżej.
  Po wyczerpaniu tur albo po czystej turze przechodzi do bramki merge'a.
- `/dev-pr 3 --bez-merge` — jak wyżej, ale kończy raportem zamiast merge'em.

Liczba tur jest twardym limitem, nie sugestią.

### Przebieg

**Faza 0 — bramka wejścia (JS).** Gałąź inna niż główna, drzewo czyste, zadanie istnieje
w `docs/completed/` lub `docs/active/`. `gh pr view --json number,state,mergeable,mergeStateStatus,
headRefOid` — jeśli pull requesta nie ma, utwórz: `gh pr create --body-file <plik>`, gdzie treść
powstaje z `<zadanie>-podsumowanie.md` plus sekcja **„Świadomie nienaprawione"** z otwartych P3
i pozycji `known-issues.md`. Nigdy przez stdin — `gh` zwraca zero przy pustej treści.

**Faza 1 — czekanie na recenzję.** `Monitor` z pętlą until na `gh pr view --json reviews,comments`,
aż pojawi się recenzja bota dla bieżącego `headRefOid` i zniknie znacznik „reviewing". Limit czasu
(domyślnie 20 minut), po nim raport „bot nie odpowiedział" i wyjście bez zmian w kodzie.

**Faza 2 — zebranie i klasyfikacja.** Pobierz nierozwiązane wątki inline plus treść recenzji
(`gh api`). Subagent klasyfikuje **każdy wątek** według rubryki:

| Klasa | Kryterium |
|---|---|
| `napraw` | realny defekt: bezpieczeństwo, poprawność, utrata danych, złamany kontrakt — albo drobiazg tańszy do naprawy niż do dyskusji |
| `napraw-szerzej` | uwaga trafna i występująca też w bliźniaczych miejscach; naprawa obejmuje wszystkie |
| `odrzuć` | bot nie zna decyzji projektowej; **wymaga cytatu** z `CLAUDE.md`, planu albo `docs/CONCEPTS.md` jako uzasadnienia |
| `do-operatora` | wymaga decyzji produktowej albo ryzyko nie do ograniczenia w tej turze |

Kryterium priorytetu, o które prosił operator: klasyfikator ocenia wpływ **na teraz i na dalszy
ciąg projektu** — czy to klasa błędu, która się powtórzy; czy dotyka kontraktu, schematu bazy albo
granicy zaufania; czy blokuje kolejne fazy z mapy faz. Ten wynik idzie do pola `wplywNaProjekt`
i jest tym, co operator widzi przy wyborze.

Wątki tej samej przyczyny klastruj — jedna naprawa zamyka kilka komentarzy.

**Faza 3 — decyzja.** Interaktywnie: `AskUserQuestion` z listą pogrupowaną po klasie, z krótkim
opisem wpływu. Autonomicznie: bierzemy `napraw` i `napraw-szerzej`; `odrzuć` dostaje odpowiedź
w wątku; `do-operatora` zatrzymuje turę i trafia do raportu.

**Faza 4 — naprawa (workflow).** Subagent naprawia wybrane wątki, tak jak fix w autopilocie.
Bramka jakości: `typecheck`, `test`, `build` — komendy czytane z `package.json`, nie zaszyte.
Odpowiedzi w wątkach: co zrobiono albo dlaczego odrzucono, z cytatem. Commit jawnym pathspecem
(zakaz `git add -A`), push.

**Faza 5 — kolejna tura albo domknięcie.** Po pushu bot robi recenzję przyrostową, więc wracamy
do fazy 1 z licznikiem tur. Zero wątków albo wyczerpany limit → domknięcie.

**Faza 6 — bramka merge'a (JS, tylko tryb autonomiczny).** Merge dopiero gdy **wszystkie** warunki:
`mergeable = MERGEABLE`, `mergeStateStatus = CLEAN`, zero nierozwiązanych wątków klasy `napraw`,
zero `do-operatora`, wszystkie testy CI zielone. Którykolwiek warunek niespełniony → raport
„gotowy do Twojej decyzji" z listą tego, co zostało.

**Faza 7 — compound.** To jest część, której dziś brakuje najbardziej. Uruchom `/dev-compound`
z diffem wszystkich tur poprawek i listą wątków. Zadanie: zapisać do `docs/solutions/` **klasy
błędów**, które bot znalazł po naszym review, i ocenić rule-worthy do `learned-patterns.md`.

Dodatkowo — pętla zwrotna do reviewerów: jeśli ta sama klasa uwagi pojawia się w drugim pull
requeście z rzędu, compound proponuje regułę do konkretnego agenta-reviewera (np. brakujący nagłówek
bezpieczeństwa → `security-sentinel`). Propozycja idzie do raportu, wdrożenie zostaje decyzją
operatora.

### Rzeczy do rozstrzygnięcia przy implementacji

- Bot bywa nieprzewidywalny w czasie odpowiedzi (w danych: pull request otwarty 22:13, tury
  następnego dnia 08:58). Monitor jest związany z sesją, więc tryb autonomiczny ma sens tylko
  w sesji, którą operator zostawia otwartą. To ograniczenie trzeba napisać wprost w skillu.
- `gh` jest zainstalowany (wersja 2.83.2), `.coderabbit.yaml` w `oferty-online` ma
  `auto_incremental_review: true` — czyli każda tura poprawek dostaje recenzję automatycznie.
- Skill wchodzi do README: diagram pipeline'u zyskuje krok `→ /dev-pr → merge` po
  `/dev-docs-complete`, plus wiersz w tabeli workflowów.

---

## Odłożone do osobnej decyzji

Pozycje z etapu 6 audytu, których operator nie objął tą rundą. Zostają udokumentowane, żeby nie
zginęły.

| Pozycja | Dlaczego warto wrócić |
|---|---|
| Parametryzacja toru E2E (`E2E_BASE_URL`, `E2E_HEALTH_PATH`, `E2E_DEV_CMD`) | 28 wystąpień portu 5173 w 9 plikach; `oferty-online` ma lokalny patch workflowu, który **skasuje pierwsza synchronizacja szablonu** |
| Hooki `Stop` | sprawdzanie typów po każdej odpowiedzi bez bramki zmian; w monorepo oba hooki martwe; README opisuje je nieprawdziwie |
| Oś pomiaru w telemetrii | pola mierzą tokeny wyjściowe, a nazywają się „rozbicie tokenów"; brak czasu ściennego; uszkodzone wpisy (`'$TS'`, ujemne wartości) |
| Harness ewaluacyjny | bez niego każda zmiana progu w Turze B jest zgadywaniem — rozrzut kosztu review to 8,5× |

Uwaga o zależności: **parametryzacja toru E2E powinna wyprzedzić najbliższe `/sync-template`
w `oferty-online`**, inaczej synchronizacja zepsuje tam testy end-to-end.

---

## Kolejność wykonania

1. **Tura A w całości** — jedna sesja, pozycje niezależne, każda z osobnym commitem.
2. **B1 (P3), B2 (commit artefaktów)** — najpierw te dwie, bo zmieniają zachowanie widoczne od razu.
   Odpal jedno zadanie w `oferty-online` i zobacz koszt fixa oraz brak STOP-a na artefaktach.
3. **B3 i B4 (dossier, sceptycy, tiery)** — razem, bo dotykają tego samego promptu i tej samej fazy.
4. **B5–B11** — pojedynczo, w dowolnej kolejności.
5. **B12 (konsolidacja reviewerów)** — ostatnia, z warunkiem odwrotu.
6. **Tura C (`/dev-pr`)** — osobna sesja, bo to nowy kod, nie poprawka.

Po każdej turze: `git status` czysty, README zgodny ze stanem faktycznym, a przy zmianach
w workflowach smoke-test z `.claude/templates/smoke-autopilot/` na realnym projekcie.

---

## Review wprowadzonych zmian

> **Wypełnione 2026-09-06** na dowodach z dwóch pełnych zadań: `oferty-online/faza-7-szablony-i-grafiki`
> (6 faz) i `claude-cron/zalaczniki-w-skrzynce` (4 fazy). Pełny raport z liczbami, progami i nowymi
> znaleziskami: `docs/reviews/2026-09-06-audyt-powdrozeniowy.md`.

Rozdział do wypełnienia **po pierwszym pełnym runie na realnym projekcie**. Plan jest wdrożony, ale
żadna z tych zmian nie została jeszcze zweryfikowana runem — zmiany powstały na dowodach z 39 runów
historycznych, nie na dowodach, że działają.

**Czego potrzebuję od operatora, żeby zacząć:** ścieżki do projektów, na których run się odbył
(np. `~/Documents/Kodowanie/oferty-online`). Nic więcej — reszta wynika z plików w repo.

### Zasada przeglądu

Zaczynam od **dowodów, nie od pytań**. Cztery źródła, w tej kolejności:

| Źródło | Co z niego biorę |
|---|---|
| `~/.claude/telemetry/autopilot-runs.jsonl` | ostatnie wpisy: `raporty[].tokenyEtapy`, `liczniki`, `przebieg`, `status`, `powod`, `fix.p3Pominiete` |
| `<projekt>/docs/active/<zadanie>/.autopilot-state.json` | `fazy[].metryki` — źródło prawdy o fazach, także po STOP-ie |
| `<projekt>/docs/{active,completed}/<zadanie>/review-faza-N.md` | `## Przebieg review` + `## Obalone przez verify` |
| `git log` w projekcie | commity `fix(...)`, `docs(<zadanie>): stan pipeline'u po STOP`, `fix(...): kontrola diffu naprawczego`, `fix(pr): tura N` |

Wpis „nie da się sprawdzić, bo run nie dotknął tej ścieżki" jest **poprawnym wynikiem** i lepszym niż
naciągnięte „wygląda OK". Zmiana nietknięta przez run zostaje niezweryfikowana i tak ją zapisuję.

### Trzy progi alarmowe (liczby, nie wrażenia)

| # | Metryka | Oczekiwanie | Próg alarmowy | Co zrobić po przekroczeniu |
|---|---|---|---|---|
| 1 | mediana `tokenyEtapy.fix` | wzrost 34k → **60–80k** | **>120k** po dwóch zadaniach | `LIMIT_P3_GLOBALNY` z 15 z powrotem na 8 **albo** zawężenie P3 do typu KOD w `otwartePoReview` |
| 2 | czas i liczba wywołań narzędzi reviewerów | spadek po dossier | brak spadku **przy** `przebieg.dossier: true` | dossier powstaje, ale reviewerzy i tak czytają pełne dokumenty → zaostrzyć `zrodlaBlok` |
| 3 | liczba **potwierdzonych** P1/P2 typu KOD przez 5 faz | bez zmian albo wzrost | **spadek** | rozdzielić `code-quality` z powrotem na `architecture` + `simplicity` + `typescript` (agenci zostali w repo) |

Uwaga do #2: **nie mierz tokenów wyjściowych.** Oszczędność z dossier jest po stronie wejścia i w
`tokenyEtapy` jej nie widać. `przebieg.dossier: false` oznacza cichy fallback — zmiana nie zadziałała,
a run wygląda identycznie jak przed nią.

Uwaga do #3: sam spadek `poDedupSem` **bez** spadku potwierdzonych to **sukces**, nie regresja —
mniej duplikatów przy tej samej wykrywalności jest dokładnie tym, po co ta konsolidacja powstała.

### Tura A — co sprawdzić

| Poz. | Sprawdzenie | Gdzie | Wynik |
|---|---|---|---|
| A1 | zero STOP-ów `blokerSrodowiska` na findingu, który opisuje **kod**, nie awarię | telemetria: `status: STOP` + `powod` zawierający „BLOKERZE SRODOWISKA" | **DZIAŁA** — jedyny taki STOP (09-04 16:49, `dev-server-nieosiagalny`) był realną awarią, potwierdzoną niezależnie w `e2eSync` fazy 6 (port 5173 zajęty przez obcy projekt) |
| A2 | po STOP-ie na blokerze `metryki` i `otwarteFindingi` są wypełnione | `.autopilot-state.json`, wpis telemetrii ma `liczniki` ≠ `null` | **DZIAŁA** — `257df3d`: metryki 6/6 faz, 18 otwartych findingów fazy 6; telemetria `fazyZMetrykami: 6`. Ale świeży run je porzuca → N2 |
| A3 | brak wpisów `e2eTryb: 'przegladarka'` przy `e2eCheckboxy: 0` (historycznie 10/18) | `przebieg` w telemetrii | **CZĘŚCIOWO** — hist. 7/15 → teraz 2/6; oba pozostałe to nowa ścieżka `figmaScreens`, ale ich wynik to 0 PASS / 0 FAIL / 0 SKIP |
| A4 | `best-practices-researcher` sięgnął po Context7 | transkrypt `/dev-plan` | **NIEZWERYFIKOWANE** — brak transkryptów; Context7 jest w definicji agenta (`:72,78`), co dowodzi intencji, nie przebiegu |
| A5 | bramka gotowości `/dev-docs` realnie zatrzymała handoff na `[blokuje: faza 1]` **albo** przepuściła przy czystej checkliście | transkrypt `/dev-docs`, sekcja `## Blokery operatora per faza` w `plan.md` | **DZIAŁA (przepuszczenie)** — `oferty/plan.md:73` ma sekcję z 1 pozycją dla fazy 6, handoff przeszedł zgodnie z regułą N≥2. Ścieżka STOP nietknięta → niezweryfikowana |
| A6 | commit WIP nie wciągnął plików spoza zadania | `git log` + `git show --stat` commitów `wip(...)` | **NIEZWERYFIKOWANE** — zero commitów `wip(` w obu projektach, `/dev-docs-update` nie był użyty |
| A7 | `przebieg.severityKorekty.odrzucone` > 0 przy P2 — czyli reguła realnie coś blokuje | `## Przebieg review` | **DZIAŁA, ale nie tym pomiarem** — 5 śladów `*(sceptyk sugerował P3 — utrzymane P2)*` w treści raportów. Sama metryka nie istnieje w żadnym z trzech źródeł → N3 |
| A8 | nikt nie sięgnął po `/dev-autopilot` (katalog nie istnieje) | transkrypt | **DZIAŁA** — brak w szablonie; w projektach katalog istnieje, ale pusty (skill niewywoływalny). Puste katalogi po syncu → N8 |

### Tura B — co sprawdzić

| Poz. | Sprawdzenie | Gdzie | Wynik |
|---|---|---|---|
| B1 | P3 typu KOD/TEST są na liście `otwarteFindingi`; `fix.p3Pominiete` ma **uzasadnienia treściowe**, nie „to nit" | telemetria, log fazy | **DZIAŁA** — `p3Pominiete` = 0 w 6 z 7 faz; `naprawione` = p1+p2+p3 w 5 z 7. Raport `oferty/review-faza-4.md:118`: „Findingi P3 (KOD/TEST — idą do fixa)" |
| B1 | mediana `tokenyEtapy.fix` — **próg 1** | telemetria | **W NORMIE** — 34k → **75k** (n=7: 45,63,63,75,105,106,110). Pasmo 60–80k, próg 120k nieprzekroczony. `LIMIT_P3_GLOBALNY` zostaje na 15 |
| B2 | zniknął STOP „niezacommitowane zmiany" **bezpośrednio po innym STOP-ie** (historycznie 6/39) | telemetria: dwa kolejne wpisy STOP tego samego zadania | **DZIAŁA** — 3 commity `stan pipeline'u po STOP` (`ce00d0c`, `257df3d`, `0fa9f92`), po żadnym nie ma STOP-a „niezacommitowane" |
| B3 | `przebieg.dossier: true` we wszystkich fazach; plik `/tmp/review-ctx-*.md` powstał | `## Przebieg review` | **POWSTAJE; EFEKT NIEZNANY** — 10/10 plików `/tmp/review-ctx-*.md` (30–57 KB). `przebieg.dossier` nie istnieje → **próg 2 niemierzalny** (N3) |
| B4 | `przebieg.sceptycy.p2Grupy` < `p2Findingi` — batchowanie realnie zmniejsza liczbę agentów | `## Przebieg review` | **NIEZWERYFIKOWANE** — metryka liczona (`review-wf:1270`), ale nie trafia do raportu, stanu ani telemetrii → N3 |
| B5 | `kontrolaFixa` cokolwiek łapie, czy jest zawsze pusta; jeśli pusta w 5 fazach — pre-skan albo nie działa, albo fix jest czysty | raport fazy | **DZIAŁA, MOCNO** — 7/10 faz ma `kontrolaFixa` ≠ null. `oferty` faza 5: **61 pozycji, 55 naprawionych** (`60f1951` — zdjęte rzutowania `as` z kodu i testów). PASS przy 55/61 → N9 |
| B6 | findingi z nowych osi: wektory obejścia u `security`, `await` bez `catch` u `code-quality` | `review-faza-N.md` | **DZIAŁA** — `claude-cron/review-faza-3.md`, P2/KOD `inbox-pull.mjs:110`: „Wektory obejścia bramki, żaden bez testu odmowy" (5 wektorów). §4/§13: `kieran-typescript-reviewer.md:75,77` |
| B7 | `spec-compliance-reviewer` cytuje ID wymagania w **każdym** findingu; koszt niższy niż historyczne 174k | raport, telemetria | **DZIAŁA (cytaty); KOSZT NIEMIERZALNY** — findingi cytują IU (np. „IU-4 deklaruje…"). Telemetria nie rozbija `tokenyEtapy.review` per reviewer |
| B8 | plik zadań nie rośnie liniowo z fazami; sekcje „Do poprawy" zamkniętych faz zwinięte, ale **niezaznaczone wiersze zostały** | `wc -c` na `*-zadania.md`, treść sekcji | **DZIAŁA** — 10/10 faz ma „Do poprawy" zwinięte do jednej linii („Zamkniete cyklem fix: N pozycji"), niezaznaczone wiersze zostały w „Operator checklist faza N" |
| B9 | prompty builderów zawierają blok „Decyzje przywołane przez to IU"; brak komentarzy w kodzie typu „sam znalazłem plik checklisty" | transkrypt, `git diff` fazy | **CZĘŚCIOWO** — instrukcja jest (`dev-docs-execute-wf.js:148`), brak transkryptów builderów → przebieg niezweryfikowany |
| B10 | plik kontekstu ma 4 sekcje, nie 7; nikt nie odtworzył „Decyzje techniczne" | `*-kontekst.md` | **DZIAŁA** — `claude-cron` 4 sekcje, `oferty` 5 (plus „Designerski kontekst" z toru Figmy). Zero „Decyzje techniczne"/„Kluczowe pliki"/„Odroczone"/„Wzorce" |
| B11 | sekcja `## Obalone przez verify` istnieje i **nie jest pusta** — jeśli pusta w każdej fazie, sceptycy nie obalają nic i cena verify jest do rewizji | `review-faza-N.md` | **DZIAŁA** — sekcja w 10/10 raportach, niepusta w 5, mediana `obalone` = 1/fazę. Obalenia merytoryczne: reprodukcja na żywym serwerze, pomiar `duration_ms` istniejącego testu |
| B12 | **próg 3** + czy `correctness` zgłasza findingi ze scenariuszem awarii, a nie uwagi stylistyczne | raport, telemetria | **DZIAŁA; ODWROTU NIE ROBIMY** — mediana P1+P2/fazę 4 → **6,5** (wzrost 63%), przy `poDedupSem` 28 → 19,5 (−30%). `correctness` produkuje falsyfikowalne hipotezy o zachowaniu (finding o `drain: true` obalony eksperymentem) |

### Tura C — co sprawdzić

Osobno, bo `/dev-pr` **nigdy nie działał na realnym pull requeście**.

| Sprawdzenie | Gdzie | Wynik |
|---|---|---|
| GraphQL `reviewThreads` zwraca wątki (nie pusto przy widocznych komentarzach) | transkrypt etapu `zbierz` | **DZIAŁA** — 23 (`oferty#8`), 39 (`#9`), 17 (`claude-cron#15`) wątków |
| mutacja `addPullRequestReviewThreadReply` działa — czy trzeba było fallbacku na REST | transkrypt etapu `napraw` | **DZIAŁA** — 36 odpowiedzi od `AIBiz-Automatyzacje` na `#9`, 13 na `#15`; brak śladu fallbacku |
| PR ma **niepusty** opis (kontrola reguły „nigdy przez stdin") | `gh pr view` | **DZIAŁA** — 7 972 B / 2 389 B / 6 474 B |
| klasa `odrzuć` bez cytatu została przeklasyfikowana na `do-operatora` przez JS | log etapu `zbierz` | **KOD JEST, PRZEBIEG NIEZWERYFIKOWANY** — `dev-pr-wf.js:278-286`; brak logu etapu `zbierz` |
| żaden wątek nie został rozwiązany bez zaadresowania | wątki na PR | **DZIAŁA** — 0 wątków `isResolved` bez odpowiedzi na `#9` i `#15`; nierozwiązane zostały nierozwiązane (6/23, 10/39, 4/17) |
| compound zapisał **klasy błędów**, nie pojedyncze literówki; propozycje do reviewerów nie zostały wdrożone automatycznie | `docs/solutions/`, `git diff` na `.claude/agents/` (ma być pusty) | **DZIAŁA** — `c2d6ddd` (6 klas), `49dfcdb` (3 klasy); `.claude/agents/` nietknięte przez pipeline w obu projektach |

### Ryzyko przy synchronizacji (sprawdzić **przed**, nie po)

> **Wynik 2026-09-06: ryzyko się zrealizowało.** `oferty-online` musiało przywrócić lokalne adaptacje E2E
> skasowane przez sync (`a5e9b76`) i osobno naprawić sondę środowiska (`1de5a4c` — „sonduj srodowisko E2E
> po `.env.e2e`, nie po stalym porcie 5173"). Niezależnie od tego oba projekty trafiły na defekt składni
> w `dev-docs-execute-wf.js` przywieziony przez sync — patrz N1 w raporcie audytu.

**Parametryzacja toru E2E nie została wdrożona** — jest w rozdziale „Odłożone do osobnej decyzji".
W `oferty-online` istnieje **lokalny patch workflowu**, który `/sync-template` skasuje (szablon zawsze
wygrywa; 28 wystąpień portu 5173 w 9 plikach). Dwie drogi: kopia patcha przed synchronizacją
i przywrócenie po niej, **albo** wdrożenie parametryzacji w szablonie zanim ruszy sync.

### Otwarte decyzje operatora (stan na 2026-09-03)

1. Opcjonalny dodatek z A5 — bramka `## Blokery operatora per faza` w bootstrapie autopilota przed
   fazą N. Bez niej sekcję pisze `/dev-docs`, ale nikt jej automatycznie nie czyta.
2. Dedykowany agent dla osi `correctness` zamiast `general-purpose` z procedurą w polu `fokus`.
3. Czy commitować `docs/reviews/` (raport z audytu, ten plan, prompt startowy) — dziś nieśledzone.
4. Rozdział „Odłożone do osobnej decyzji": parametryzacja E2E, hooki `Stop`, oś pomiaru w telemetrii,
   harness ewaluacyjny.

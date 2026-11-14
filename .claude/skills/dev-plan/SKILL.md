---
name: dev-plan
description: "Planowanie techniczne z Implementation Units i przygotowanie zadania dla autopilota: plan w docs/plans/, branch feature/<zadanie>, docs/active/<zadanie>/ ze skryptu, bramka gotowości i gotowe polecenie dev-autopilot-wf."
argument-hint: "[opcjonalnie: ścieżka do requirements doc lub opis feature'a]"
---

# dev-plan — od wymagań do zadania dla autopilota

Datę do planów bierz z `date +%F`; jej rok podawaj w zapytaniach o aktualną dokumentację.

`/dev-brainstorm` (opcjonalny) ustala **CO** budować, `/dev-prep` — co człowiek dostarcza poza kodem. `/dev-plan` ustala **JAK**: pisze plan techniczny z fazami i Implementation Units (IU), a potem sam zamienia go w zadanie dla autopilota — branch `feature/<zadanie>`, pliki `docs/active/<zadanie>/` generowane skryptem `.claude/scripts/plan/plan.mjs`, bramka gotowości i gotowe wywołanie `dev-autopilot-wf`.

Skill nie pisze kodu i nie uruchamia testów aplikacji. Pytania, na które odpowiada dopiero zmiana kodu i obserwacja skutku, zapisujesz w planie jako odroczone do implementacji.

Plan techniczny jest jedynym źródłem treści zadania: builder dostaje jednostkę z planu, a generator przepisuje do `docs/active/` tylko strukturę (fazy, pliki, scenariusze, weryfikacje). Czego nie ma w planie, tego autopilot nie zrobi.

## Metoda interakcji

Pytania zadawaj narzędziem `AskUserQuestion`, jedno naraz, z opcjami single-select, gdy istnieją naturalne odpowiedzi. Bez tego narzędzia — numerowane opcje w czacie i czekanie na odpowiedź.

Jedyny wyjątek od „jedno naraz” to pozycje techniczne z przeglądu spójności (6.2b): do 5 takich pozycji w jednym pytaniu, każda z rekomendacją w jednej linii, z opcją „Pokaż po kolei”. Pozycje widoczne dla użytkownika aplikacji idą zawsze pojedynczo.

**Tryb bez pytań.** Gdy operator w tej sesji wprost oddał decyzje sesji („bez pytań”, „decyduj sam”) — także w wiadomości z sesji nadrzędnej, która przekazuje jego słowa — `AskUserQuestion` nie używasz. Każde pytanie tego skilla rozstrzygasz opcją rekomendowaną (bez rekomendacji: najbezpieczniejszą dla zakresu planu), zapisujesz decyzję w planie i wypisujesz ją w handoffie. Sesja prowadzona z innej sesji nie może odpowiedzieć za operatora w oknie wyboru, więc pytanie zadane mimo trybu zatrzymuje cały run (pilot mobile, run 6). Tryb nie obejmuje blokerów (0.5, czerwona bramka gotowości): z nimi kończysz turę opisem, nie pytaniem.

## Opis feature'a

<feature_description> #$ARGUMENTS </feature_description>

Pusty opis → szukaj `docs/brainstorms/*-requirements.md` (0.2). Nic trafnego → zapytaj: „Co chciałbyś zaplanować? Opisz feature, bug fix lub usprawnienie.” Bez jasnego wejścia nie planujesz.

Jeśli istnieje `docs/CONCEPTS.md`, przeczytaj go na starcie: to słownik pojęć projektu. Używaj jego terminów w planie i nie planuj zmian sprzecznych z definicjami (np. „naprawy” statusu, który celowo działa nietypowo).

## Zasady planu

1. **Wymagania są źródłem prawdy** — plan realizuje dokument źródłowy, nie wymyśla zachowań produktu od nowa.
2. **Decyzje, nie kod** — zapisujesz podejście, granice, pliki, zależności, ryzyka i scenariusze testowe; bez kodu implementacji i receptur komend. Wyjątek: pole Weryfikacja ma komendę w backtickach (3.4), bo scribe review ją uruchamia.
3. **Research przed strukturą** — kontekst repo, wiedza projektu i (gdy uzasadnione) dokumentacja zewnętrzna, zanim ułożysz IU.
4. **Rozmiar planu do pracy** — mała praca dostaje kompaktowy plan, duża więcej struktury; granica planowanie/wykonanie ta sama.
5. **Rozmiar pliku rozstrzygasz w planie** — tabela plików IU podaje długość pliku dziś i po zmianie; plik, który przekroczy próg, dostaje wydzielenie modułu w planie, a nie uwagę bota w PR.
6. **Postawa wykonawcza lekkim sygnałem** — test-first albo characterization-first wynikające z wymagań lub kruchego obszaru zaznaczasz `Notatką wykonawczą` w IU, bez choreografii RED/GREEN/REFACTOR.

Plan jest gotowy, gdy implementator zaczyna pewnie bez dopisywania planu za ciebie: ujęcie problemu i granice, traceability wymagań, dokładne ścieżki plików (z testami), decyzje z uzasadnieniem, wzorce do naśladowania, konkretne scenariusze testowe, zależności i kolejność.

## Przebieg

### Faza 0: Wejście, źródło i głębokość

#### 0.0 Świeża sesja

`/dev-plan` zaczynasz w świeżej sesji. Gdy przed wywołaniem w tej sesji była inna praca (`/dev-prep`, makiety, research, analiza, poprzednie zadanie), zanim cokolwiek przeczytasz, zadaj `AskUserQuestion`: „Ta sesja ma już kontekst z wcześniejszej pracy — planowanie (ok. 50 tur) ciągnęłoby go w każdej turze. Co robimy?”

- `Zrobię /clear i wrócę` (rekomendowane) — zakończ jedną linią: `/clear, potem /dev-plan <to samo wejście>`. Checklista `/dev-prep` i dokument źródłowy są na dysku, więc nic nie ginie.
- `Planuj w tej sesji` — idziesz dalej (0.1).

Koszt: w etapie 3 vibersi `/dev-plan` ruszył po `/dev-prep` z 215k kontekstu, co dało ok. 1,0 M z 6,9 M planu; raport telemetrii flaguje takie epizody (`ctx_start` > 120k). Pierwsza wiadomość sesji to `/dev-plan` → pytania nie zadajesz.

#### 0.1 Wznowienie

- Użytkownik wskazuje istniejący plan albo w `docs/plans/` jest świeży plan na ten temat → przeczytaj go i zapytaj, czy aktualizować w miejscu, czy pisać nowy. Przy aktualizacji zachowaj odhaczone checkboxy.
- Istnieje `docs/active/<zadanie>/` → to wznowienie zadania. Pokaż stan (`.autopilot-state.json`, `review-faza-N.md`, odhaczone pozycje) i zapytaj, czy tylko poprawić plan techniczny, czy przerwać. Pliki zadania z postępem zostają — `plan.mjs generuj --zapisz --nadpisz` odmawia, gdy zadanie ma przebieg. Zmianę planu technicznego po starcie (decyzja operatora po zatrzymaniu, pozycja przeniesiona do innej jednostki, nowa jednostka w fazie, która jeszcze nie ruszyła) przenosisz do pliku zadań przez `node .claude/scripts/plan/plan.mjs odswiez docs/active/<zadanie>`: najpierw bez `--zapisz` (lista zmian), potem z `--zapisz`. Skrypt nakłada różnicę między planem z `HEAD` (albo `--od <commit sprzed zmiany>`, gdy zmiana planu jest już w commicie) a planem na dysku; odhaczenia i linie dopisane przez przebieg zostają, a pozycja przeniesiona między jednostkami zabiera odhaczenie. Odmowę (nowa pozycja w zbudowanej fazie albo jednostce, zmiana faz, konflikt z linią zmienioną przez przebieg) pokazujesz operatorowi. Konflikt wymienia linie sekcji spoza planu: tę, która jest zmienioną wersją usuwanej pozycji (np. `[E2E]` przestawione przez testera na `[Manual]`), usuwasz za zgodą operatora i uruchamiasz skrypt ponownie; gdy żadna nią nie jest, dodajesz `--pomin-brakujace`. Skrypt można uruchamiać wielokrotnie: zmiany, którą plik zadań już ma, nie dopisuje drugi raz. `.autopilot-state.json` nie edytujesz ani ty, ani skrypt. Przerwany execute odkłada pracę jednostki nieukończonej do schowka gita `autopilot/<zadanie>/faza-N` (drugi STOP tej samej fazy: `#2`, `#3`): to szkic jednostki, która po decyzji operatora powstanie od nowa, więc przed świeżym runem go nie przywracasz. Po zamknięciu fazy (`execute: done` w stanie) usuwasz wpis `git stash drop stash@{<n>}` (numer z `git stash list`) za zgodą operatora. Zmieniona treść planu wymaga ponownego przeglądu spójności (6.2b) zmienionych faz i nowego zapisu, bo bramka gotowości porównuje odcisk planu z zapisem.

#### 0.2 Dokument źródłowy

Przed pytaniami planistycznymi szukaj dokumentu źródłowego w `docs/brainstorms/`. Źródłem jest każda z form:

1. requirements doc feature'a `docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md` (wynik `/dev-brainstorm`);
2. zbiorczy dokument wymagań (`mvp-requirements.md`, roadmapa etapów, PRD) — źródłem jest sekcja pasująca do feature'a plus sekcje decyzji obowiązujących; `origin:` dostaje ścieżkę z kotwicą (`docs/brainstorms/mvp-requirements.md#etap-17`), plan cytuje ID wymagań z tej sekcji;
3. wymagania podane w requeście (lista poprawek, odpowiedzi interesariusza, wynik audytu) — nadaj im stabilne ID (R1…) i przenieś do „Śledzenie wymagań”.

Dokument jest trafny, gdy temat i problem użytkownika pokrywają się z opisem feature'a; dokument feature'a starszy niż 30 dni oceń krytycznie (dokumentów żywych ten wiek nie dotyczy — liczy się aktualizacja sekcji). Kilka trafnych → zapytaj, którego użyć.

`docs/brainstorms/` to konwencja, nie gwarancja. Pusty glob → glob `docs/**/*-requirements.md` i katalogów `docs/*brainstorm*` (z pominięciem `docs/plans/`, `docs/active/`, `docs/completed/`, `docs/solutions/`, `docs/operator/`); trafienie ogłoś jednym zdaniem. Gdy i to nic nie da, zapytaj: „Nie znalazłem requirements doc — podaj ścieżkę albo potwierdź, że planujemy bez dokumentu źródłowego.” Cichy start bez dokumentu gubi istniejący brainstorm.

#### 0.3 Checklista operatora z `/dev-prep`

Zrób glob `docs/operator/*.md` (bez `*-smoke.md`) i sprawdź **frontmattery**: checklista etapu ma `origin:` wskazujący ten sam dokument lub etap. Nazwa pliku bywa dowolna (`/dev-prep` dziedziczy konwencję serii, np. `e3-operator-checklist.md`), więc szukasz po frontmatterze. Znaleziona:

- przeczytaj ją w całości; jej `feature_slug:` jest `<feature-slug>` całego przebiegu (1.6, 3.1, 5.2b);
- to ten sam plik, który uzupełnisz w 5.2b — drugiego dokumentu przygotowawczego nie tworzysz;
- sekcja „Makiety” zasila 1.6, „Decyzje” — 0.5, „Konta, konsole, sekrety” i „Assety” — 3.7;
- ogłoś: „Znalazłem checklistę operatora etapu: `<ścieżka>` (N pozycji, M nieodhaczonych) — uzupełnię ją po zbudowaniu IU.”;
- nieodhaczone pozycje `[blokuje: planowanie]` wymień i zapytaj, czy planować mimo nich (plan powstanie z lukami), czy przerwać.
- decyzję z wypełnionym „Ustalono”, która jest sprzeczna z dokumentem źródłowym (linia `Zmienia wymaganie:` przy decyzji albo rozjazd widoczny przy czytaniu obu dokumentów), pokaż przez `AskUserQuestion`: wymaganie, decyzja z datą i proponowane nowe brzmienie wymagania. Po zgodzie popraw wymaganie w dokumencie źródłowym z dopiskiem `(zmienione decyzją <nr> z <data>, <ścieżka checklisty>)` i planuj z poprawionego źródła. Odmowa to bloker z 0.5: z dwóch sprzecznych źródeł planu nie piszesz, bo builder dostaje oba (aa-exam E3: decyzja D1 w checkliście nowsza niż R48 w wymaganiach).
- decyzje „Sprawy odłożone w smoke'u” z wypełnionym „Ustalono” zamykasz w `docs/operator/odlozone.md` (po smoke'u tylko `/dev-plan` zmienia ten plik; operator go nie edytuje), linię tej sprawy zamieniasz na:
  - wchodzi → po zapisaniu planu (5.2) `- [x] [etap: <etykieta>] <treść> → w planie <ścieżka planu> (<YYYY-MM-DD>)`;
  - czeka → `- [ ] [etap: <nowa etykieta>] <treść>` (linia zostaje otwarta, zmienia się tylko etykieta);
  - rezygnacja → `- [x] [etap: <etykieta>] <treść> → rezygnacja (<YYYY-MM-DD>)`.
  Plik idzie do commitu inicjalnego (6.5) jawną ścieżką.

Brak checklisty jest poprawny — 5.2b utworzy krótką listę, jeśli będzie co wpisać.

#### 0.4 Dokument źródłowy jako wejście albo krótki bootstrap

Z dokumentem źródłowym: przeczytaj go dokładnie, ogłoś jako źródło i przenieś ujęcie problemu, wymagania i kryteria sukcesu, granice, decyzje z uzasadnieniem, zależności i otwarte pytania (z podziałem na blokujące i odroczone). Przeniesione decyzje oznaczaj w planie `(zob. źródło: <ścieżka>)`. Każda sekcja źródła ma odpowiedź w planie, choćby jednym zdaniem — sprawdzisz to w 5.1.

Bez dokumentu: oceń, czy request wystarcza do planowania technicznego. Niejasność produktowa (zachowanie użytkownika, definicja zakresu) → zarekomenduj `/dev-brainstorm`; dla bugów, tech-debtu, poprawek z listy i zadań „jak w istniejącym wzorcu” brainstormu nie rekomendujesz. Gdy użytkownik chce planować od razu, zrób krótki bootstrap: ujęcie problemu, zamierzone zachowanie, granice i non-goals, kryteria sukcesu, blokujące pytania lub założenia. Duże otwarte pytania produktowe → ponowna rekomendacja brainstormu albo jawne założenia przed dalszą pracą.

#### 0.5 Pytania blokujące

Pytania „do rozwiązania przed planowaniem” ze źródła przejrzyj po kolei. Przenieś do pracy planistycznej te, które są techniczne, architektoniczne lub badawcze; pytanie zmieniające zachowanie produktu, zakres lub kryteria sukcesu zostaje blokerem. Prawdziwe blokery pokaż i zapytaj: wrócić do `/dev-brainstorm` czy zamienić je w jawne założenia. Z nierozwiązanym blokerem planu nie piszesz.

#### 0.6 Głębokość planu

- **Lekka** — mała, dobrze ograniczona praca, niska niejednoznaczność; zwykle 2–4 IU w jednej fazie.
- **Standardowa** — zwykły feature albo ograniczony refactor z kilkoma decyzjami; 3–6 IU w 2–3 fazach.
- **Głęboka** — praca przekrojowa, strategiczna, wysokiego ryzyka albo bardzo niejednoznaczna; 4–8 IU w 3–6 fazach.

Niejasna głębokość → jedno celowane pytanie. Decyzję ogłaszasz jednym zdaniem z powodem, a źródłem prawdy jest pole frontmattera planu `glebokosc: Lekka | Standardowa | Głęboka` (`references/szablon-planu.md`, „Decyzje startowe”); `plan.mjs sprawdz` odrzuca plan bez niego.

### Faza 1: Kontekst

#### 1.1 Wiedza projektu i research lokalny

Przeczytaj w całości indeks wiedzy projektu `docs/learned-patterns.md` (jeśli istnieje): reguły z klasą, wzorcami plików i linkiem do `docs/solutions/`. Reguły pasujące do obszaru planu zasilają „Wiedza instytucjonalna” w planie i podejście IU.

Przygotuj podsumowanie kontekstu planowania (akapit lub dwa: problem, wymagania, kluczowe decyzje ze źródła albo opis feature'a). Agentów badawczych wołasz narzędziem `Agent` z typem agenta z `.claude/agents/` — nie typem `Explore` z doklejoną definicją agenta w prompcie (definicja doklejona do promptu gubi `model:`, `tools:` i `skills:` z frontmattera).

- **Standardowa i Głęboka** — zawsze, równolegle:
  - `repo-research-analyst` — prompt: linia `Scope: technology, architecture, patterns, conventions`, pod nią samo podsumowanie kontekstu (bez linii `Scope:` agent przegląda też konwencje issues i szablony PR, które planu nie zasilają);
  - `learnings-researcher` — prompt: samo podsumowanie kontekstu.
- **Lekka** — ci sami dwaj agenci tylko przy jednym z warunków:
  - (a) plan wprowadza nową zależność, usługę zewnętrzną, API albo wersję główną biblioteki (porównaj z `package.json` i istniejącymi integracjami);
  - (b) obszar, który dotkną IU, nie ma wpisu w wiedzy projektu: `node .claude/scripts/wiedza/wiedza.mjs wycinek --pliki <plik>,<plik> --bez-zawsze` zwraca pustą `tresc`, a `grep -rl '<katalog>' docs/solutions/` nic nie znajduje. W `--pliki` podajesz ścieżki plików, które IU stworzą lub zmienią (glob reguły `src/x/**/*.ts` nie dopasowuje samego katalogu); `--bez-zawsze` pomija reguły dla wszystkich plików, które pasują do każdego obszaru.
  Bez warunku czytasz wzorce sam (Glob, Grep, Read plików z obszaru) i ogłaszasz decyzję jednym zdaniem z powodem, np. „Lekka, obszar `src/services/` ma 3 reguły w indeksie, bez nowych zależności — planuję bez agentów badawczych.”

Zbierz: wzorce i konwencje do naśladowania, pliki, moduły i testy obszaru, wytyczne z CLAUDE.md wpływające na plan, wiedzę z `docs/solutions/`.

#### 1.2 Postawa wykonawcza

Sygnały: użytkownik prosi o TDD / test-first / characterization-first, źródło tego wymaga, research pokazuje kruchy lub słabo przetestowany obszar. Jasny sygnał przenosisz do odpowiednich IU jako `Notatka wykonawcza`; pytasz tylko, gdy postawa zmienia kolejność albo ryzyko i nie da się jej wywnioskować.

#### 1.3 Research zewnętrzny (warunkowy)

Research zewnętrzny wołasz, gdy temat jest wysokiego ryzyka (bezpieczeństwo, płatności, prywatność, zewnętrzne API, migracje, compliance), repo nie ma lokalnego wzorca albo użytkownik wchodzi na nieznany teren — przy Lekkiej to warunek (a) z 1.1. Pomijasz, gdy repo ma silny wzorzec, a użytkownik zna docelowy kształt. Decyzję ogłoś jednym zdaniem i zapisz w polu frontmattera `research_zewnetrzny: "tak — <powód>"` albo `"nie — <powód>"` (powód jednym zdaniem) — pole jest źródłem prawdy, `sprawdz` odrzuca plan bez niego. Research: równolegle `best-practices-researcher` i `framework-docs-researcher`, prompt = samo podsumowanie kontekstu.

#### 1.4 Konsolidacja

Zbierz w notatkach: wzorce i ścieżki plików, wiedzę projektu, referencje zewnętrzne, powiązane PR / issues, ograniczenia kształtujące plan.

#### 1.5 Analiza flow (Standardowa, Głęboka albo niejasne flow)

Wywołaj `spec-flow-analyzer` z podsumowaniem kontekstu i wynikami researchu. Bierzesz z wyniku brakujące edge case'y, przejścia stanów i luki, które realnie poprawiają plan.

#### 1.6 Kontekst designerski (feature dotykający UI)

Ustal teraz `<feature-slug>` (kebab-case, 3–5 słów) — użyjesz go bez zmian w 3.1, w `docs/plans/<feature-slug>-figma/` i w 5.2b. Checklista z 0.3 daje slug gotowy (`feature_slug:`).

**Krok A — klasyfikacja (bez pytania).** Feature dotyka UI, gdy wymagania opisują ekrany, komponenty, layouty, nawigację, animacje albo stany widoczne dla użytkownika, lub research wskazuje pliki warstwy UI wg `.claude/stack/buildery.md`, sekcja „Ścieżki warstw”. Praca w warstwie danych z tej sekcji, testach i konfiguracji to pure-data. Ogłoś wynik jednym zdaniem i zapisz go w polu frontmattera `dotyka_ui: tak | nie` (źródło prawdy; `sprawdz` odrzuca plan bez niego, a przy `nie` i IU dla buildera UI albo fullstack daje uwagę); pytaj tylko, gdy po researchu nadal nie wiesz.

- Pure-data → frontmatter planu: `design_md: null`, `figma_spec: null`, `figma_screens: {}`; reszta 1.6 odpada.
- Dotyka UI → przeczytaj `references/kontekst-designerski.md` i wykonaj kroki B–F (DESIGN.md, makiety Figmy, SPEC.md, idempotentność).

Klasyfikacja jest wstępna: IU delegowany do `feature-builder-ui` lub `feature-builder-fullstack` w planie pure-data oznacza powrót do kroków B–F przed dalszym planowaniem.

### Faza 2: Pytania planistyczne

Zbierz pytania z odroczonych pytań źródła, luk z researchu i decyzji technicznych potrzebnych do planu. Każde jest **rozwiązane w planowaniu** (odpowiedź poznawalna z repo, dokumentacji albo wyboru użytkownika) albo **odroczone do implementacji** (zależy od kodu, zachowania runtime'u, odkryć w wykonaniu). Użytkownika pytasz tylko o to, co zmienia architekturę, zakres, kolejność albo ryzyko i nie da się wywnioskować. Nie uruchamiasz testów, nie budujesz aplikacji i nie badasz runtime'u.

Przy przebudowie istniejącego ekranu albo maila bez zasady „znika czy zostaje” w źródle i w checkliście pytasz o nią tutaj: „Gdy makieta nie pokaże czegoś, co obecna wersja ma: znika czy zostaje?”, z opcjami `Znika — makieta jest kompletna`, `Zostają treść i dane, zmienia się wygląd`, `Decyzja przy każdym elemencie` (wtedy pytasz o elementy z pól „Znika z obecnej wersji”). Odpowiedź zapisujesz w „Kluczowych decyzjach” planu.

### Faza 3: Struktura planu

#### 3.1 Tytuł i plik

Tytuł w formacie konwencjonalnym (`feat: Dodaj autentykację użytkowników`, `fix: Zapobiegaj podwójnemu submitowi`), typ `feat` | `fix` | `refactor`. Plik: `docs/plans/YYYY-MM-DD-NNN-<type>-<feature-slug>-plan.md` — data z `date +%F`, NNN = kolejny numer planu z tą datą w `docs/plans/` (od 001). Z nazwy pliku powstaje nazwa zadania (`<feature-slug>`), branch `feature/<feature-slug>` i katalog `docs/active/<feature-slug>/`.

#### 3.2 Interesariusze

Dla Standardowej i Głębokiej rozważ, kogo dotyczy zmiana (użytkownicy, developerzy, operacje, inne zespoły); przy pracy przekrojowej opisz to w „Wpływ systemowy”.

#### 3.3 Implementation Units i fazy

IU = jedna znacząca zmiana, którą implementator wyląduje jako atomowy commit: jeden komponent, zachowanie albo szew integracyjny, mały klaster plików, uporządkowany po zależnościach, konkretny bez pre-pisania kodu. Unikasz mikro-kroków na minuty, jednostek z kilkoma niepowiązanymi problemami i jednostek, w których implementator wciąż musi wymyślić plan.

Fazy są obowiązkowe na każdej głębokości, bo autopilot wykonuje plan fazami (faza = `execute → review → fix`), a generator przenosi je do zadania 1:1:

- każda IU w dokładnie jednej fazie; nagłówek `### Faza N — <nazwa>`, numeracja od 1 bez luk, pod nim `**Zależy od:** Brak | Faza K` i opcjonalnie `**Równolegle z:** Faza M` (informacja dla operatora — autopilot wykonuje fazy po kolei);
- faza kończy się w stanie, który da się zreviewować i przetestować niezależnie (typecheck i testy przechodzą, aplikacja działa); typowy układ: fundament danych → warstwa danych i akcje → strony i komponenty → polish i E2E; trywialna IU dołącza do sąsiedniej fazy;
- IU ze scenariuszem `[E2E]` stoi w fazie, w której istnieje wszystko, czego flow potrzebuje (strona, dane, seed);
- faza ma najwyżej 5 IU, a migracje przepisujące istniejące funkcje bazy (`create or replace` funkcji z poprzednich etapów, `drop function` + `create` RPC) stoją w fazie bez fundamentu serwera i klienta — review takiej fazy czyta same zmiany schematu (vibersi etap 5: faza z 3 migracjami, serwerem, E2E i Sentry po podziale dała dwa mniejsze review); `sprawdz` daje uwagę przy fazie powyżej 5 IU;
- IU z co najmniej 8 scenariuszami testowymi albo 12 plikami to błąd `sprawdz`, dopóki nie ma jawnej decyzji: builder takiej jednostki ma 2–3 razy więcej tur i kontekstu (vibersi etapy 3–5: 10+ plików — tury p50 72 i kontekst 227k wobec 27 i 89k przy 1–3 plikach). Dzielisz ją na granicy zachowania albo warstwy, gdy obie części dają się zreviewować osobno; jednostkę spójną zostawiasz z polem `**Rozmiar:** zostaje w całości (<P> plików, <S> scenariuszy) — <powód>` — wtedy `sprawdz` daje uwagę jak dawniej. Liczby w polu to rozmiar z chwili decyzji: gdy jednostka później urośnie ponad nie (poprawki po przeglądzie dopisują pliki testów do tabel — vibersi audyt-paczki-1-2: IU-9 z 9 do 15 plików), `sprawdz` daje uwagę o przyroście, a ty oceniasz podział od nowa i aktualizujesz liczby. O podziale decydujesz przed przeglądem spójności (6.2b): podział po przeglądzie zmienia fazy i wymaga ich ponownego przeglądu.

Numeracja IU jest ciągła przez cały plan (IU-1, IU-2, …).

#### 3.4 Pola IU

Format jednostki i całego planu jest w `references/szablon-planu.md` — przeczytaj go przed pisaniem (Faza 4). Pola: Cel, Wymagania, Zależności, Pliki (tabela, 3.6), Rozmiar (IU ponad progiem z 3.3, która zostaje niepodzielona), Delegate to (3.5), Makiety (IU ui/fullstack w planie z `figma_screens`), Skills in play, Podejście, Notatka wykonawcza (opcjonalna), Teksty (verbatim) (obowiązkowe, gdy IU renderuje zatwierdzone treści), Znika z obecnej wersji (IU z makietami, która modyfikuje istniejący plik), Wzorce do naśladowania, Scenariusze testowe, Weryfikacja, Operator checklist (opcjonalna).

- **Makiety** — w planie z `figma_screens` każda IU ui/fullstack wymienia ekrany, które buduje (`**Makiety:** \`logowanie-komputer\`, \`logowanie-telefon\``), albo `—`. Planner wkleja builderowi SPEC i PNG tylko tych ekranów (`plan.mjs designerski`); IU bez pola dostaje wszystkie ekrany i cały SPEC, a `sprawdz` daje uwagę, bo pełny SPEC czytany przez każdego buildera w każdej turze to ok. 0,6 M na etap z 8 builderami UI.
- **Odwołanie do decyzji niesie jej treść.** IU trafia do buildera jako osobny prompt — builder nie widzi reszty planu. Przy każdym odwołaniu dopisz zdanie treści w nawiasie: `strażnik regresji R2 (przy zmianie CTA istniejący tracking zostaje — nowy event, nie modyfikacja)`.
- **Teksty widoczne dla użytkownika** (etykiety, nagłówki, komunikaty błędów) wklejasz dosłownie w `**Teksty (verbatim):**`, nie przez odwołanie do punktu checklisty — inaczej builder wpisze własną wersję, a review zgłosi rozjazd z zamówieniem.
- **Znika z obecnej wersji** — IU, która modyfikuje istniejący ekran albo mail według makiety, wypisuje elementy obecnej wersji, których makieta nie ma (tekst, dana jak imię albo kwota, stan, zachowanie), z decyzją przy każdym: `- powitanie z imieniem (email.service.ts:58) — znika (R25: czego makieta nie ma, znika)` albo `— zostaje (D3), pod nagłówkiem`. Elementy bierzesz z pola „Dziś pokazuje” checklisty (0.3), a bez niego z plików `Modyfikuj` tej IU; decyzję z zasady w wymaganiach albo w checkliście. Bez zasady pytasz w Fazie 2: decyzji nie wymyślasz i nie zostawiasz builderowi. Element, który zostaje, ma tekst w „Teksty (verbatim)” i scenariusz; element, który znika, nie wraca w Podejściu ani w scenariuszach, także gdy ma go plik z „Wzorców do naśladowania”. `—`, gdy nic nie znika. `sprawdz` daje uwagę przy IU z makietami i wierszem `Modyfikuj` bez tego pola, a planner fazy przekazuje pole builderowi z zakazem przenoszenia tych elementów z obecnego pliku i ze wzorca (aa-exam E3: podejście i test z obecnego maila z imieniem, makieta bez powitania, run zatrzymany pytaniem buildera).
- **Scenariusze testowe** — każda pozycja zaczyna się typem: `[Unit]` (test kodu), `[E2E]` (flow w przeglądarce, 3.4b), `[Manual]` (krok człowieka, np. fizyczne urządzenie). Feature-bearing IU ma plik testu w tabeli plików.
- **Weryfikacja** — tylko kryteria, które scribe review domknie sam: każda pozycja ma komendę w backtickach (`pnpm typecheck`, test jednego pliku wg `.claude/stack/walidacja.md`, sekcja „Runner testów i build”, `grep …`), opisaną oczekiwanym wynikiem. Runner z `e2e/` idzie wyłącznie jako `[E2E]` (3.4b) — bez znacznika scribe uruchomiłby go bez środowiska e2e. Krok człowieka idzie do `Operator checklist` albo `[Manual]`.
- **Operator checklist** — kroki człowieka po implementacji (akceptacja designera, test na urządzeniu, `supabase db push --linked` na dev/prod po merge'u — w CLI 3 bez flagi celu idzie na lokalny stack). Trafiają do sekcji operatora fazy i do smoke'u operatora przy archiwizacji.
- **Atrybuty, od których zależy widoczność, wypisujesz osobno dla każdego elementu.** Cookie (`Path`, `Domain`, `HttpOnly`, `Secure`, `SameSite`, ważność), nagłówki CORS i CSP, granty: w Podejściu każdy element ma swoją listę atrybutów, bez „jak wyżej” i „ta sama ważność”. Element czytany w innej warstwie, niż powstaje (cookie-znacznik czytany przez `document.cookie`, nagłówek czytany przez klienta), dostaje scenariusz `[Unit]` na odczyt w tej warstwie, a czyszczenie — te same `Path` i `Domain` co nadanie (inaczej przeglądarka go nie usunie). vibersi etap 5: `vibersi_gosc` z `Path=/api`, a znacznik dla klienta „ta sama ważność” — skopiowany `Path=/api` ukryłby go przed stroną.
- **Migracja, która usuwa albo zmienia istniejące dane** (przed CHECK, `not null`, unikalnością, backfillem): w Podejściu liczba wierszy trafia do logu migracji (`get diagnostics` + `raise notice`) albo ograniczenie powstaje `not valid` i dopiero potem `validate constraint`; scenariusz `[Unit]` sprawdza seedy e2e po migracji. Baza dev bywa wspólna dla stagingu i środowiska lokalnego — ciche usunięcie znika bez śladu.
- **Znaczniki tylko na początku pozycji.** `[E2E]`, `[Manual]`, `[Unit]`, `Operator:`, `[P1]`–`[P3]` w środku treści dokładają linię do grepów prechecku, testera i completion-gate — w treści pisz to słowami („test w przeglądarce”).

#### 3.4b Scenariusze E2E i seedy

Autonomiczne E2E działa na dedykowanym projekcie testowym z `.env.e2e`, nigdy na dev/prod. Środowisko stawia i sprząta autopilot (start aplikacji wg `.claude/stack/e2e-srodowisko.md`, `supabase db push` migracji i seedów, konto `E2E_TEST_EMAIL`); tester `feature-tester-e2e` prowadzi aplikację narzędziem jazdy stacku.

- Scenariusz: format linii wg `.claude/stack/plan-e2e.md`, sekcja „Linia scenariusza”; `<flow>` to stabilny kebab-case identyfikator. To jedyna linia scenariusza: db-sync bierze z niej seed, tester i scribe dopasowują przebieg po nazwie flow. Jeden flow = jedna linia w całym planie.
- `Weryfikacja: [E2E]` tylko dla runnera `.sh`, który nie jest scenariuszem (ścieżka runnera w tej samej sekcji slotu) — druga linia dla tego samego flow to drugi przebieg w licznikach.
- Seed jest deliverablem buildera: wiersz w tabeli plików IU albo ścieżka istniejącego seeda w linii scenariusza wg `.claude/stack/plan-e2e.md`, sekcja „Seedy”. Autor seeda w bloku testera albo w Weryfikacji = seed, którego nikt nie napisze.
- Seed jest idempotentny (DELETE albo upsert) i wskazuje konto przez `(select id from auth.users where email='<E2E_TEST_EMAIL>')`, bez stałych ID; flow loguje się e-mailem i hasłem konta testowego, nigdy przez OAuth.
- Smoke RLS (odmowa nie-uczestnikowi) wykonujesz SQL-em na bazie e2e (`psql "$SUPABASE_E2E_DB_URL"`), bez Supabase MCP.
- Realtime: jeden klient (render, wysłanie, optimistic + echo) jest `[E2E]`; dwóch klientów na żywo → `[Manual]`.
- Wysyłka maili albo SMS w scenariuszach fazy (rejestracja, reset hasła, ponowna wysyłka, link logowania): policz wysyłki wszystkich scenariuszy `[E2E]` fazy razy dwa, bo re-review po fixie i ponowienie scenariusza wysyłają w tej samej godzinie jeszcze raz. Porównaj tę liczbę z limitem godzinowym usługi na projekcie e2e, odczytanym z jego konfiguracji, nie z dokumentacji ani z researchu. Supabase Auth bez własnego SMTP ma domyślnie 2 maile na godzinę, a Send Email hook tego limitu nie omija; odczyt robisz poleceniem `curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/projects/<ref e2e>/config/auth | jq '{rate_limit_email_sent, rate_limit_sms_sent}'`. Całej odpowiedzi nie wypisujesz, bo zawiera sekrety (hasło SMTP, sekrety dostawców logowania). Limit mniejszy od policzonej liczby → pozycja w checkliście przygotowania (3.7) z podniesieniem limitu na projekcie e2e i markerem `[blokuje: faza N]`, bo kolejna wysyłka w godzinie kończy scenariusz błędem limitu zamiast wynikiem.
- Projekt bez `.env.e2e`: scenariusz zostaje `[E2E]` tylko z pozycją setupu środowiska w checkliście (3.7). Opt-out do `[Manual]` to decyzja operatora: pytasz o nią, podając liczbę pozycji ręcznych, i proponujesz `/weryfikacja-setup` (aa-exam: opt-out zamienił 29 pozycji w klikanie na produkcji, choć stos lokalny działał).
- `[Manual]` zapisujesz bez podziału na kroki człowieka i agenta: sesja smoke'u (`/dev-smoke`) wykonuje każdą pozycję sama, a człowiekowi oddaje tylko wyjątki (produkcja i deploy, zewnętrzne konsole, fizyczne urządzenie, prawdziwa skrzynka pocztowa, płatność prawdziwą kartą, wpisanie hasła, ocena punktów wizualnych).
- Scenariusz, który zapisuje albo czyta przez serwer aplikacji, albo sprawdza status HTTP lub meta trasy renderowanej przez serwer: start serwera, sonda i adres w linii scenariusza wg `.claude/stack/plan-e2e.md`, sekcja „Serwer aplikacji w scenariuszu”.

#### 3.5 Builder IU

`Delegate to:` = builder z `.claude/agents/`, dobrany po ścieżkach tabeli plików wg `.claude/stack/buildery.md`, sekcja „Tabela builderów” (role `feature-builder-ui`, `feature-builder-data`, `feature-builder-fullstack` i ich `Skills in play`).

IU, którą da się rozsądnie podzielić na UI i dane, dzielisz; `feature-builder-fullstack` zostaje dla podziału sztucznego (formularz logowania: UI bez wywołania auth i auth bez formularza są bezużyteczne). `Skills in play:` odzwierciedla `skills:` z frontmattera buildera — dokumentacyjnie, dla czytelnika planu.

Plan pisze bazowe nazwy builderów. Warianty `feature-builder-ui-figma` i `feature-builder-fullstack-figma` (z narzędziami Figma MCP i skillami Figmy) wybiera planner fazy, gdy kontekst designerski zadania ma `figma_spec` albo `figma_screens`.

#### 3.6 Tabela plików i budżet pliku

Pole `**Pliki:**` to tabela `| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |`, jeden plik na wiersz. Akcje: `Stwórz`, `Modyfikuj`, `Usuń`, `Test (unit)`, `Stwórz (e2e seed)`; akcje pliku flow, jeśli stack go ma: `.claude/stack/plan-e2e.md`, sekcja „Linia scenariusza”.

- **Kompletność.** Tabela wymienia każdy plik, który IU stworzy lub zmieni: źródła, testy, migracje, seedy, konfigurację. Planner dobiera do promptu buildera reguły wiedzy projektu po tych ścieżkach — plik spoza tabeli to builder bez reguł dla niego.
- **Linie dziś.** Policz skryptem: `node .claude/scripts/plan/plan.mjs linie <plik> <plik>` — linie kodu jak ESLint `max-lines` (bez pustych i komentarzy). Nowy plik: `0`. Plik z wcześniejszej IU tego planu: „dziś” = jej „po”.
- **Linie po** — szacunek po zmianie IU. Obie kolumny zapisujesz liczbami całkowitymi (`120 → 180`), bez `~` i słów; plik spoza kodu (SQL, markdown) może mieć `— → —`.
- **Próg 300 linii na plik.** Plik kodu, który po zmianie przekracza 300, dostaje ocenę wymiarów w kolumnie Wymiary: powody zmiany (ile niezależnych powodów, by plik się zmieniał), eksporty między warstwami, importy z wielu domen, test-lustro (czy test da się podzielić tak jak plik), reguła 5 s (czy w 5 sekund wiesz, co plik robi). Wymiar pęknięty → werdykt `wydziel <co>` i wiersz `Stwórz` nowego modułu w tej samej IU, a „po” liczysz po wydzieleniu.
- **Próg 360 linii na plik** (300 + 20% tolerancji) to próg ESLint i bota PR: plik powyżej 360 po zmianie zawsze dostaje wydzielenie.
- Werdykt bez przekroczeń: `nowy` albo `zostaje`.
- **Usuń.** Wiersz usuwanego pliku ma „dziś” z repo i `—` po strzałce (`45 → —`), a werdykt `—`. Plik usuwasz w tej IU, w której znika jego ostatni importer, albo później: każdy plik, który go importuje, ma wiersz `Usuń` albo `Modyfikuj` w tej samej albo wcześniejszej IU. Builder nie usuwa pliku z żywym importem, więc faza kończy się jako częściowa i autopilot staje (dashboard E2: IU-19 usuwała komponent importowany przez plik usuwany dopiero w IU-32). `plan.mjs sprawdz` szuka importerów w repo i daje uwagę z nazwą importera i IU, w której plan go zmienia.

`plan.mjs sprawdz` (6.2) liczy „dziś” w repo i odrzuca tabelę z rozjazdem ponad tolerancję, plik powyżej 360, przekroczenie 300 bez wymiarów i `wydziel` bez wiersza `Stwórz`.

#### 3.6b Rejestr stałych

Sekcja planu `## Rejestr stałych` — tabela `| Stała | Wartość | Plik | IU-źródło | Konsumenci |` dla wartości, których używa więcej niż jedna IU albo warstwa: statusy, limity, nazwy tras, klucze zapytań, kody błędów, nazwy zdarzeń, etykiety i teksty (nazwy powodów, statusów, kategorii), które pokazuje klient i wysyła serwer. Wartość czytana przez serwer i klienta ma plik w module bez Reacta, nie w warstwie UI ani w hookach (ścieżki: `.claude/stack/buildery.md`, sekcja „Ścieżki warstw”) — serwer nie importuje warstwy UI; `sprawdz` daje uwagę, gdy źródło jest w warstwie UI, a konsument ma pliki w `server/` albo `supabase/functions/`. Każda stała ma jedno źródło — plik w tabeli plików pierwszej IU, która jej używa; tę IU wpisujesz w kolumnie IU-źródło (`IU-5`), także gdy plik tworzy wcześniejsza IU, a stała dochodzi później. Jeden wiersz = jedna IU-źródło (`A` / `B` w jednym wierszu tylko przy tej samej IU), komórka nigdy pusta; stała, która już jest w repo: `—`, a w kolumnie Plik plik, w którym już jest. Używa = importuje w kodzie: wartość przepisana do migracji SQL nie czyni IU źródłem, bo eksport bez konsumenta w kodzie zgłasza knip w domknięciu fazy, a `plan.mjs sprawdz` daje uwagę, gdy źródło jest w fazie wcześniejszej niż wszyscy konsumenci. IU-źródło zapisuje w Podejściu definicję dosłownie (`MAKS_DLUGOSC_NOTATKI = 500` w `src/services/notatki-limity.ts`), a IU-konsumenci importują stałą stamtąd i powtarzają w Podejściu nazwę z wartością — planner fazy nie dokleja builderowi rejestru. Bez rejestru dwie IU w osobnych promptach definiują tę samą wartość dwa razy. Plan bez takich wartości: „Brak stałych współdzielonych.”

#### 3.6c Części PR

Bot recenzji PR obejmuje do 150 plików. `plan.mjs sprawdz` (6.2) liczy szacunek plików do recenzji: ścieżki z tabel plików IU po filtrach `.coderabbit.yaml` plus test obok każdego pliku kodu bez testu w planie — pole `rozmiarPr` (per faza, per część i `propozycja`). Szacunek powyżej 150 wymaga sekcji `## Części PR` z tabelą `| Część | Fazy |` (np. `| 1 | 1–3 |`, `| 2 | 4–6 |`): cięcie tylko na granicy faz, części pokrywają fazy po kolei, każda poniżej 150 — punkt wyjścia to `propozycja` ze `sprawdz`. Faza, która sama ma ponad 150, to błąd — dzielisz fazę, bo cięcie przechodzi tylko między fazami. Archiwizacja zmierzy części na commitach końca faz, a `/dev-pr --czesc N` wyśle je kolejno. Projekt bez bota recenzji (`.claude/projekt.json`: `recenzjaPr: "bez-bota"`, zapisuje go `/dev-pr` albo `tryb-recenzji.mjs --ustaw bez-bota`) nie ma tego progu: `sprawdz` daje przy szacunku powyżej 150 uwagę zamiast błędu, liczy pliki z wykluczeniami domyślnymi (`docs/`, `.claude/`, lockfile), a sekcję `## Części PR` piszesz tylko wtedy, gdy operator chce wysłać zmianę w kilku PR-ach z innego powodu, np. wdrożenia etapami.

#### 3.7 Wymagania wstępne operatora

Wypisz to, czego autopilot nie zrobi sam, a bez czego plan utknie: konta i konsole zewnętrzne, sekrety i zmienne środowiskowe, środowisko E2E (plan z `[E2E]` bez `.env.e2e`), assety i treści, dane na projekcie głównym potrzebne do implementacji, dostępy. Tabela kategorii ze źródłami, reguły delty wobec checklisty z `/dev-prep` i markery `[blokuje: …]` są w `references/przygotowanie-operatora.md` — przeczytaj go, gdy lista ma choć jedną pozycję albo istnieje checklista z 0.3. Pusta lista → `operator_prep: null` i brak pliku.

#### 3.8 Niewiadome

Coś ważnego, ale niepoznawalnego przed kodem (nazwy helperów, finalny SQL, zachowanie zależne od failujących testów, refaktor, który może okazać się zbędny), zapisujesz w „Otwarte pytania → Odroczone do implementacji”, nie udajesz rozstrzygnięcia.

### Faza 4: Napisz plan

Przeczytaj `references/szablon-planu.md` i pisz plan według niego. Głębokość zmienia ilość szczegółów, nie granicę planowanie/wykonanie: Lekka pomija opcjonalne sekcje; Standardowa ma pełny szablon z ryzykami, odroczonymi pytaniami i wpływem systemowym; Głęboka dokłada sekcje analizy z szablonu, gdy realnie pomagają. Diagram mermaid dołączasz, gdy proza nie oddaje relacji (ERD, sekwencja usług, stany, złożone rozgałęzienia).

Plan nie zawiera kodu implementacji (chyba że kształt kodu jest artefaktem designu), komend git ani commit message'y, kroków RED/GREEN/REFACTOR i numerów linii jako referencji (ścieżki i symbole zamiast nich).

### Faza 5: Przegląd, zapis i checklista operatora

#### 5.1 Przegląd przed zapisem

- Plan nie wymyśla zachowań produktu należących do `/dev-brainstorm`; każda główna decyzja ma oparcie w źródle albo researchu; odroczone sprawy są jawne.
- Z dokumentem źródłowym: przeczytaj go ponownie — podejście pasuje do intencji, granice i kryteria są zachowane, blokery rozwiązane albo jawnie założone, każda sekcja źródła ma odpowiedź w planie.
- Każde ID ze „Śledzenia wymagań” ma IU, która je wymienia w polu Wymagania (`sprawdz` zgłasza brak jako uwagę).
- Każda IU: konkretna, w kolejności zależności, z `Delegate to:` wg 3.5 i `Skills in play:` zgodnym z builderem, z tabelą plików wg 3.6, z odwołaniami do decyzji niosącymi treść.
- Frontmatter ma decyzje startowe `glebokosc`, `research_zewnetrzny` (z powodem) i `dotyka_ui` zgodne z tym, co ogłosiłeś w 0.6, 1.3 i 1.6, oraz `design_md`, `figma_spec`, `figma_screens`, `operator_prep` — ścieżki albo jawne `null` / `{}`; `figma_spec` i ekrany `figma_screens` istnieją na dysku. Plan z IU ui/fullstack przeszedł kroki B–C z 1.6 (`figma_spec: null` tylko jako świadoma odpowiedź „projektujemy z głowy”).
- Scenariusze są konkretne, ale nie są kodem testu; Weryfikacja wg 3.4; `[E2E]` wg 3.4b.
- Każda IU z makietami i wierszem `Modyfikuj` ma pole „Znika z obecnej wersji”; element z decyzją „znika” nie występuje w Podejściu, Tekstach ani scenariuszach tej IU.
- Twierdzenia o stanie repo w Ryzykach i Kluczowych decyzjach sprawdzone w kodzie, nie z pamięci: ryzyko budżetu paczki opierasz na routerze (które trasy ładują się przez `lazy(`) i wypisujesz, co faktycznie trafia do pliku startowego (vibersi etap 5: plan liczył widoki strony projektu do pliku startowego, a strona była już leniwa).
- „Wymagania wstępne operatora” zgadzają się z `operator_prep`; plan z `[E2E]` bez `.env.e2e` ma pozycję setupu albo opt-out do `[Manual]`.

#### 5.2 Zapis planu

`mkdir -p docs/plans/` i zapisz plan narzędziem Write do `docs/plans/YYYY-MM-DD-NNN-<type>-<feature-slug>-plan.md`. Potwierdź: `Plan zapisany do docs/plans/<plik>`.

#### 5.2b Checklista operatora

Gdy delta z 3.7 jest niepusta: uzupełnij checklistę z 0.3 narzędziem Edit albo utwórz `docs/operator/<feature-slug>-przygotowanie.md` wg `references/przygotowanie-operatora.md`. Faktyczną ścieżkę wpisz do `operator_prep:` planu. Potwierdź: `Checklista operatora: <ścieżka> (N pozycji, M z [blokuje: faza 1])`.

### Faza 6: Zadanie dla autopilota

Wynik fazy: plan bez błędów skryptu, branch `feature/<zadanie>` z commitem inicjalnym, `docs/active/<zadanie>/` i bramka gotowości. `<zadanie>` = `<feature-slug>` z nazwy pliku planu, chyba że użytkownik podał inną nazwę.

#### 6.1 Bramka E2E per scenariusz

Dla każdego scenariusza `[E2E]` w planie prześledź flow po krokach:

- **Natywne okno albo zewnętrzny system** — czego narzędzie jazdy nie wykona, jak to obejść i kiedy krok idzie na `[Manual]`: `.claude/stack/plan-e2e.md`, sekcja „Granice narzędzia jazdy”.
- **Dane spoza stanu bazowego** konta `E2E_TEST_EMAIL` (nowe rekordy, relacje, uprawnienia) → w IU jest wiersz `Stwórz (e2e seed)` albo ścieżka istniejącego seeda w linii scenariusza wg `.claude/stack/plan-e2e.md`, sekcja „Seedy”.
- **Trasa serwera aplikacji** (zapis albo odczyt przez `/api/…`) → środowisko E2E uruchamia ten serwer wg 3.4b; jeśli skrypt startu dopiero powstaje, pozycja checklisty z `[blokuje: faza N]` jest w planie.

Zatrzymujesz się i pytasz tylko przy: (a) scenariuszu bez identyfikatora flow albo bez wykonalnych kroków — domyślna propozycja to dopisanie flow i kroków do planu, `[Manual]` jako świadomy opt-out; (b) flow z natywnym oknem lub zewnętrznym systemem bez obejścia seedem; (c) danych spoza stanu bazowego bez seeda. Poprawki wprowadzasz w planie technicznym.

#### 6.2 Walidacja planu skryptem

```bash
node .claude/scripts/plan/plan.mjs sprawdz <docs/plans/plik-planu.md>
```

Wynik JSON: `bledy` i `uwagi` z numerami linii i identyfikatorami IU. Każdy błąd poprawiasz w planie technicznym (Edit) i uruchamiasz `sprawdz` ponownie, aż `ok: true`. Skrypt opisuje kontrakt konsumentów zadania — poprawiasz plan, nie skrypt. Uwagi (origin bez pliku, migracja w opisie bez pliku w `supabase/migrations/`, luka w numeracji IU) pokazujesz użytkownikowi w handoffie.

#### 6.2b Przegląd spójności planu

Każdy plan, także Lekki, przechodzi przegląd spójności przed zadaniem dla autopilota (punkt 41: w aa-exam E3 test wymagał imienia w mailu logowania, makieta i teksty go nie miały, a granice zabraniały tekstów spoza makiet — faza 3 stanęła w runie, bo nikt nie zestawił źródeł przed startem). Decyzje o podziale dużych IU (3.3, pole Rozmiar) zapadają przed tym krokiem.

1. **Czytanie.** Po zielonym `sprawdz` zapisz czytanie każdej fazy, którą teraz przeglądasz — po kolei, w jednym poleceniu, bo zapis idzie do jednego pliku: `for f in <fazy>; do node .claude/scripts/plan/plan.mjs spojnosc docs/plans/<plik>.md --faza $f --czytanie; done`. Wynik podaje `tura` fazy. Potem uruchom naraz, narzędziem `Agent` z typem `spojnosc-planu`, po jednym agencie na fazę planu, z poleceniem: „Przegląd spójności fazy <N> planu `docs/plans/<plik>.md`, tura <T>.” Polecenie ma tylko to zdanie: bez dopisków o sprawach rozstrzygniętych, zakresie czy głębokości — rozstrzygnięte sprawy agent rozpoznaje po oznaczeniu w planie (punkt 4), a od tury 2 sam pobiera ze skryptu różnicę fazy (`--roznica`) i sprawdza zmienione miejsca zamiast całej fazy. Agent czyta plan, wymagania, checklistę przygotowania, SPEC makiet i obecne pliki sam, ze świeżym kontekstem; planu nie zmienia.
2. **Czysty wynik.** Faza z wynikiem „Faza N: brak otwartych pozycji.” → `node .claude/scripts/plan/plan.mjs spojnosc docs/plans/<plik>.md --faza <N> --czysta`. Od tej chwili każda zmiana treści fazy wymaga kolejnego czytania albo zgody operatora na zamknięcie bez niego (punkt 7).
3. **Pytania do operatora.** Każda pozycja ma typ `[widoczna]` albo `[techniczna]`. Pozycję widoczną pokazujesz operatorowi po jednej narzędziem `AskUserQuestion`: kontekst prostym językiem (co użytkownik aplikacji zobaczy), opcje ze skutkiem, rekomendacja jako pierwsza opcja z uzasadnieniem. Pozycje techniczne możesz pokazać paczką do 5 w jednym pytaniu: każda w jednej linii z rekomendacją, opcje `Przyjmij wszystkie rekomendacje` i `Pokaż po kolei` (wtedy pytasz o każdą osobno). Pozycji nie rozstrzygasz sam. Wyjątki to pozycje techniczne po limicie tur (punkt 6) i tryb bez pytań (Metoda interakcji): w nim każdą pozycję, także widoczną, nanosisz według rekomendacji recenzenta z oznaczeniem `(przyjęte przez sesję RRRR-MM-DD, tryb bez pytań)`, a pozycje widoczne wypisujesz w handoffie osobno, do przejrzenia przez operatora przed smoke'iem.
4. **Poprawka planu.** Po odpowiedzi poprawiasz plan (pole jednostki wskazane w „Poprawce planu po wyborze”: Podejście, Teksty, scenariusz, „Znika z obecnej wersji”, Kluczowe decyzje) albo dokument wskazany w pozycji. Poprawione miejsce dostaje oznaczenie: `(decyzja operatora RRRR-MM-DD)` przy pozycji rozstrzygniętej osobno, `(przyjęte zbiorczo RRRR-MM-DD)` przy pozycji z paczki przyjętej jednym kliknięciem, `(przyjęte przez sesję RRRR-MM-DD)` przy pozycji technicznej naniesionej po limicie tur — dzięki temu wiadomo, które decyzje operator widział osobno, a recenzent nie zgłasza ich ponownie. Decyzja sprzeczna z wymaganiami idzie wg 0.3 (operator zgadza się na poprawkę wymagania).
5. **Kolejna tura.** Po poprawkach: `sprawdz` jeszcze raz i ponowny przegląd faz, które zmieniłeś (punkt 1 — nowe czytanie, wyższa tura), aż każda faza ma wynik „brak otwartych pozycji”.
6. **Limit tur.** Po trzeciej turze fazy (`--czytanie` zwraca `poLimicie: true` od tury 4) do operatora wracają tylko pozycje widoczne. Techniczne nanosisz sam według rekomendacji recenzenta, z oznaczeniem `(przyjęte przez sesję …)`, i wypisujesz je w handoffie. Gdy po ich naniesieniu fazy nikt nie przeczytał, zamykasz ją wg punktu 7.
7. **Zapis.** `node .claude/scripts/plan/plan.mjs spojnosc docs/plans/<plik>.md --zapisz --fazy <wszystkie fazy po przecinku> --otwarte 0`. Skrypt porównuje bieżący odcisk każdej fazy z odciskiem jej ostatniego czystego czytania i odmawia zapisu, gdy faza zmieniła się po nim albo nie była przeczytana na czysto. Wtedy czytasz ją jeszcze raz (punkt 1) albo pytasz operatora przez `AskUserQuestion`: „Faza <N> zmieniła się po ostatnim czytaniu (<co naniesiono>). Czytamy ją jeszcze raz (ok. <koszt tury> i kilka minut) czy zamykamy bez czytania?” z opcjami `Czytamy jeszcze raz` i `Zamykamy bez czytania`. Tylko po wyborze zamknięcia dopisujesz `--bez-czytania <numery faz>`: bramka gotowości jest wtedy zielona „z zastrzeżeniem”, a zastrzeżenie idzie do handoffu. Flagi `--bez-czytania` nie używasz bez tej zgody, także po limicie tur; w trybie bez pytań fazę czytasz jeszcze raz. Plik `docs/plans/<plik>.spojnosc.json` (odcisk planu bez stanu checkboxów i bez sekcji `## Decyzje z realizacji`, do której domknięcie fazy dopisuje decyzje korygujące plan; odciski faz i pól z czytań) idzie do commitu inicjalnego. Operator świadomie zostawia pozycję otwartą → zapis z `--otwarte <N>`; bramka gotowości zostaje wtedy czerwona.

#### 6.3 Git i branch

1. `git status --short --untracked-files=all` i podział pozycji:
   - **(a) artefakty planowania** pod `docs/plans/`, `docs/operator/`, `docs/brainstorms/` — stan oczekiwany; zapamiętaj listę ścieżek do commitu inicjalnego (`git checkout -b` przenosi je na nowy branch, więc plan ląduje na `feature/<zadanie>`, nie na `main`);
   - **(b) każda inna pozycja** (kod, `e2e/`, `.env*`, `package.json`, inne docs) → stop i pytanie: zacommitować te pliki na bieżącym branchu, schować je (`git stash push -u -- <ścieżki z (b)>` — gołe `git stash` nie chowa nieśledzonych, a `-u` bez ścieżek schowałby też plan) albo przerwać. Ścieżek z (a) nie stashujesz i nie commitujesz na `main`.
2. Branch: `git branch --show-current` = `feature/<zadanie>` → zostajesz; `git branch --list feature/<zadanie>` niepuste → najpierw sprawdź, czy to nie gałąź zakończonego zadania o tym samym slugu (`git merge-base --is-ancestor feature/<zadanie> main` albo istniejące `docs/completed/<zadanie>/`) — wtedy zapytaj o inną nazwę zadania; inaczej `git checkout feature/<zadanie>`; brak gałęzi → `git checkout -b feature/<zadanie>` z `main` albo `develop` (z innego brancha — zapytaj).

#### 6.4 Pliki zadania

```bash
node .claude/scripts/plan/plan.mjs generuj <docs/plans/plik-planu.md> --zapisz [--nazwa <zadanie>]
```

Skrypt zapisuje `docs/active/<zadanie>/<zadanie>-plan.md`, `-kontekst.md` i `-zadania.md` i zwraca liczniki (fazy, IU, checkboxy implementacyjne, `Test:`, `Weryfikacja:`, `[E2E]`, pozycje operatora). Plików zadania nie piszesz ani nie poprawiasz ręcznie — zmiana idzie przez plan i ponowne `generuj`. Odmowa „katalog zadania już istnieje” przy wznowieniu bez przebiegu autopilota → `--nadpisz`; odmowa z powodu przebiegu (stan autopilota, raport review, odhaczone pozycje, wpisy dziennika) → zmiana planu idzie przez `plan.mjs odswiez` (0.1); pokaż odmowę i zapytaj, jak dalej, tylko gdy operator chce zadanie wygenerować od nowa.

#### 6.5 Commit inicjalny

`git add docs/active/<zadanie>/` plus dokładnie ścieżki z 6.3 (a): plan techniczny, zapis przeglądu spójności `docs/plans/<plik>.spojnosc.json`, `docs/plans/<feature-slug>-figma/`, checklista z `operator_prep:` (dokładna ścieżka z frontmattera), zmieniony dokument źródłowy, `docs/operator/odlozone.md` (gdy 0.3 go zmienił). Bez `git add -A` i bez całego `docs/plans/`. Commit: `docs: inicjalizacja planu dla <zadanie>`.

#### 6.6 Bramka gotowości

```bash
node .claude/scripts/plan/plan.mjs gotowosc docs/active/<zadanie>
```

Wynik ma dziewięć pozycji, każdą wypisujesz w handoffie:

- `plan` — błędy strukturalne planu technicznego (po 6.2 zwykle puste);
- `e2e` — scenariusze `[E2E]` i makiety `figma_screens` vs środowisko: to samo sprawdzenie co bootstrap autopilota (`.env.e2e` w `.gitignore`, klucze bazy e2e, baza inna niż dev, `migrations.sum`, kontrola narzędzia jazdy z adaptera E2E), bez startu serwera. Brak `.env.e2e` przy scenariuszach albo pozycja w `bledy` zatrzyma autopilota przed fazą 1 → setup albo poprawka wg `.claude/templates/e2e-env/README.md` (jednorazowo, ~30 min); przy scenariuszach druga droga to opt-out `[E2E]` → `[Manual]` w planie i ponowne `generuj --nadpisz`. Zadanie z samymi makietami bez `.env.e2e` przechodzi (porównanie z makietą idzie bez przeglądarki do operatora), a przy błędnym `.env.e2e` naprawiasz plik. `uwagi` (brak skilla weryfikacji projektu) nie blokują startu — wypisz je z komendą `/weryfikacja-setup`;
- `przygotowanie` — `blokujace` (`[blokuje: planowanie]`, `[blokuje: faza 1]`, marker bez numeru) zatrzymują start: wypisz je z liniami i podaj drogi (odhaczyć albo świadomie usunąć marker); `odroczone` (fazy ≥ 2) generator wpisał do `## Blokery operatora per faza` w planie zadania, a autopilot zatrzyma się przed fazą N, dopóki pozycja jest nieodhaczona w checkliście — operator robi ją po fazie, która ją umożliwia, odhacza, commituje checklistę i odpala świeży run;
- `git` — branch `feature/<zadanie>` i czyste drzewo; autopilot nie przełącza brancha i zatrzymuje się na brudnym drzewie;
- `testy` — runner testów projektu (vitest, jest) nie zbiera testów maszynerii z `.claude/**`; `ok: false` = autopilot zatrzyma się na `npm test` na starcie → wpisz do configu `poprawka` i zacommituj;
- `claudeMd` — pliki decyzji na gałęzi głównej bez `claude_md: do-uzgodnienia`; `ok: false` = autopilot zatrzyma się na starcie → wypisz `naprawa` (uzgodnienie na gałęzi głównej przez `/dev-pr --claude-md <zadanie>`, potem wciągnięcie głównej do gałęzi zadania);
- `spojnosc` — przegląd spójności planu (6.2b): zapis istnieje, odcisk planu się zgadza (odhaczenia i sekcja `## Decyzje z realizacji` go nie zmieniają, zmiana treści tak), zero otwartych pozycji, każda faza przejrzana. `ok: false` zatrzymuje start → wypisz `powod` i wróć do 6.2b dla wskazanych faz. `ok: true` z niepustym `zastrzezenie` (faza zamknięta bez czytania za zgodą operatora, 6.2b punkt 7) nie blokuje: wypisz `powod` („OK z zastrzeżeniem: …”). Autopilot sprawdza to samo na starcie (`plan.mjs blokery`): świeże zadanie bez ważnego przeglądu kończy STOP-em, zadanie w toku dostaje uwagę;
- `higiena` — nie blokuje, ale każdą `uwagi` wypisz z komendą przed startem: stara baza wiedzy (`learned-patterns.md` w `.claude/rules/`, przed konwersją: `/dev-compound-refresh --konwersja`) albo kontekst startowy agenta ponad próg (CLAUDE.md + reguły bez `paths:`) kosztują każdego agenta każdej fazy. Operator decyduje, czy porządkuje przed autopilotem; pełna lista kontroli jest w doctorze (`bash .claude/scripts/doctor/doctor.sh`).
- `odlozone` — nie blokuje: otwarte sprawy odłożone w smoke'u poprzednich zadań (`docs/operator/odlozone.md`, `otwarte`: etap, treść, linia). Wypisz każdą z etapem; sprawa z etykietą tego etapu, której nie ma w planie, to pytanie do operatora, czy wchodzi teraz (dopisanie IU), czy czeka dalej, czy rezygnujemy. Odpowiedź zapisujesz w pliku wzorem z 0.3 (wchodzi / czeka / rezygnacja) i commitujesz jawną ścieżką. Pole `decyzje` (zadanie, wiersz) to decyzje poprzednich zadań, których nikt nie rozstrzygnął (smoke pominięty albo przerwany): wypisz każdą z odsyłaczem do `/dev-smoke <zadanie>`; nie blokują.

Czerwona pozycja usuwana w tej sesji (odhaczenie checklisty, opt-out, `.gitignore` po setupie e2e) zmienia śledzone pliki: zacommituj je jawnymi ścieżkami (`git add <ścieżki> && git commit -m "docs(<zadanie>): przygotowanie operatora"`) i uruchom `gotowosc` ponownie. Autopilota nie uruchamiasz przy czerwonej bramce.

#### 6.7 Handoff

Wypisz wynik w formacie poniżej. Gdy bramka jest zielona i użytkownik wybiera start, uruchom autopilota narzędziem `Workflow` w tej sesji — chyba że ta sesja zmieniła `.claude/`.

Po zmianach w `.claude/` autopilot rusza w nowej sesji. Gdy w tej sesji zmieniono cokolwiek w `.claude/` (edycja skilla, agenta, workflowu, `/sync-template`), handoff wskazuje nową sesję i autopilota u siebie nie uruchamiasz, także gdy użytkownik wybiera start. Instrukcje i skille są buforowane w sesji, więc agenci runu działaliby według starej wersji (dashboard E2: sesja planowania zmieniła `.claude/agents/feature-tester-e2e.md`, a handoff mówił „autopilot w tej sesji”). Skrypt tego nie wykrywa — oceniasz to po przebiegu sesji.

Start to osobna wiadomość z samym poleceniem startu. Wiadomość, która uruchamia workflow, dostaje dosłownie każdy agent runu jako głos użytkownika (dashboard, run `wf_a495d97e-47b`: warunek „jeśli próbny zrzut padnie, zatrzymaj się” z wiadomości startowej dostało 166 agentów, a testerzy faz 7–11 przerwali E2E po pierwszej nieudanej próbie).

- Wiadomość operatora, która wybiera start, zawiera też warunki albo prośby → najpierw je obsługujesz, potem prosisz o osobną wiadomość z samym startem. Workflowu z takiej wiadomości nie uruchamiasz.
- Tekst, który podpowiadasz operatorowi do wklejenia w innej sesji, dzielisz tak samo: wymagania wobec sesji w jednej wiadomości, samo polecenie startu w następnej.

## Format wyjściowy

```
✅ Zadanie "<zadanie>" gotowe dla autopilota

📄 Plan techniczny: docs/plans/<plik>.md (głębokość: <glebokosc>, research: <research_zewnetrzny>, UI: <dotyka_ui> — z frontmattera)
🔀 Branch: feature/<zadanie>
📁 docs/active/<zadanie>/ (wygenerowane plan.mjs)
   - <N> faz, <K> IU
   - <X> checkboxów impl., <Y> Test:, <Z> Weryfikacja:, <E> [E2E], <M> operator
📝 Commit: docs: inicjalizacja planu dla <zadanie>
🔎 Uwagi skryptu: <lista albo brak>

🚦 Bramka gotowości (plan.mjs gotowosc):
   - Plan: OK
   - E2E: <E scenariuszy; środowisko OK / BRAK albo błędy → setup albo opt-out; uwaga: skill weryfikacji>
   - Przygotowanie: <brak / ścieżka: blokujące start B → STOP albo OK; odroczone do faz ≥ 2: K (w planie zadania)>
   - Git: <OK / brudne pozycje>
   - Testy: <OK / nie dotyczy / szczegół + poprawka configu>
   - CLAUDE.md: <OK / zadania do uzgodnienia + naprawa → STOP>
   - Spójność: <OK (fazy: …) / OK z zastrzeżeniem: faza N zmieniona po ostatnim czytaniu (decyzja operatora) — nie blokuje / powod → STOP>
   - Przegląd spójności: <tury per faza; pozycje przyjęte zbiorczo: K; techniczne naniesione przez sesję po limicie tur: lista albo brak; tryb bez pytań: widoczne przyjęte przez sesję do przejrzenia — lista albo brak>
   - Higiena: <OK / uwagi z komendą — nie blokują>
   - Odłożone: <brak / M otwartych: etap — treść (linia) — nie blokują>

➡️ Następny krok: autopilot w tej sesji <albo: w nowej sesji — ta sesja zmieniła .claude/>:
   Workflow({ scriptPath: ".claude/workflows/dev-autopilot-wf.js", args: "docs/active/<zadanie>" })
   Start to osobna wiadomość z samym poleceniem, np. „Uruchom autopilota dla docs/active/<zadanie>” — bez warunków i próśb, bo dostaje ją każdy agent runu.
   Do agentów workflow: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z polecenia workflowu.
   Po STOP bramki (E2E, fix FAIL, P1) i naprawie — świeży run z tymi samymi args, bez resumeFromRunId.
   Po awarii runu (crash) — Workflow({ scriptPath, resumeFromRunId, args }) z tymi samymi args.
```

Przy czerwonej bramce `➡️ Następny krok` wskazuje najpierw usunięcie czerwonych pozycji i commit, potem autopilota.

## Referencje

- `references/szablon-planu.md` — szablon planu z przykładową IU (Faza 4)
- `references/kontekst-designerski.md` — kroki B–F kontekstu designerskiego (1.6)
- `references/przygotowanie-operatora.md` — kategorie, delta wobec `/dev-prep`, szablon checklisty (3.7, 5.2b)
- `references/stack.md` — fragmenty stacku dla planowania (przykłady do 3.7); routing builderów i scenariusze E2E: `.claude/stack/buildery.md`, `.claude/stack/plan-e2e.md`
- `.claude/scripts/plan/plan.mjs` — nagłówek pliku opisuje polecenia i kody wyjścia
- Konsumenci `docs/active/`: `.claude/workflows/dev-autopilot-wf.js`, `dev-docs-execute-wf.js`, `dev-docs-review-wf.js`, `dev-docs-complete-wf.js` — kontrakt pilnuje `.claude/workflows/__tests__/kontrakt-docs-active.test.mjs`

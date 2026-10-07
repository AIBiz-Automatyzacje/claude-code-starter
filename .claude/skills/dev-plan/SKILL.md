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

**Tryb pipeline** (wywołanie z workflowu albo z `disable-model-invocation`): pytania pomijasz, wybory podejmujesz sam i doprowadzasz plan do zapisu; Fazy 6 nie wykonujesz.

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

#### 0.1 Wznowienie

- Użytkownik wskazuje istniejący plan albo w `docs/plans/` jest świeży plan na ten temat → przeczytaj go i zapytaj, czy aktualizować w miejscu, czy pisać nowy. Przy aktualizacji zachowaj odhaczone checkboxy.
- Istnieje `docs/active/<zadanie>/` → to wznowienie zadania. Pokaż stan (`.autopilot-state.json`, `review-faza-N.md`, odhaczone pozycje) i zapytaj, czy tylko poprawić plan techniczny, czy przerwać. Pliki zadania z postępem zostają — `plan.mjs generuj --zapisz --nadpisz` odmawia, gdy zadanie ma przebieg.

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

Niejasna głębokość → jedno celowane pytanie.

### Faza 1: Kontekst

#### 1.1 Wiedza projektu i research lokalny

Przeczytaj w całości indeks wiedzy projektu `docs/learned-patterns.md` (jeśli istnieje): reguły z klasą, wzorcami plików i linkiem do `docs/solutions/`. Reguły pasujące do obszaru planu zasilają „Wiedza instytucjonalna” w planie i podejście IU.

Przygotuj podsumowanie kontekstu planowania (akapit lub dwa: problem, wymagania, kluczowe decyzje ze źródła albo opis feature'a). Agentów badawczych wołasz narzędziem `Agent` z typem agenta z `.claude/agents/` — nie typem `Explore` z doklejoną definicją agenta w prompcie (`Explore` nie ma narzędzi sieciowych, a definicja w prompcie gubi `model:` i `tools:` z frontmattera).

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

Research zewnętrzny wołasz, gdy temat jest wysokiego ryzyka (bezpieczeństwo, płatności, prywatność, zewnętrzne API, migracje, compliance), repo nie ma lokalnego wzorca albo użytkownik wchodzi na nieznany teren — przy Lekkiej to warunek (a) z 1.1. Pomijasz, gdy repo ma silny wzorzec, a użytkownik zna docelowy kształt. Decyzję ogłoś jednym zdaniem. Research: równolegle `best-practices-researcher` i `framework-docs-researcher`, prompt = samo podsumowanie kontekstu.

#### 1.4 Konsolidacja

Zbierz w notatkach: wzorce i ścieżki plików, wiedzę projektu, referencje zewnętrzne, powiązane PR / issues, ograniczenia kształtujące plan.

#### 1.5 Analiza flow (Standardowa, Głęboka albo niejasne flow)

Wywołaj `spec-flow-analyzer` z podsumowaniem kontekstu i wynikami researchu. Bierzesz z wyniku brakujące edge case'y, przejścia stanów i luki, które realnie poprawiają plan.

#### 1.6 Kontekst designerski (feature dotykający UI)

Ustal teraz `<feature-slug>` (kebab-case, 3–5 słów) — użyjesz go bez zmian w 3.1, w `docs/plans/<feature-slug>-figma/` i w 5.2b. Checklista z 0.3 daje slug gotowy (`feature_slug:`).

**Krok A — klasyfikacja (bez pytania).** Feature dotyka UI, gdy wymagania opisują ekrany, komponenty, layouty, nawigację, animacje albo stany widoczne dla użytkownika, lub research wskazuje pliki w `src/components/`, `src/features/`, `src/pages/`, `*.css`. Praca w `src/lib/`, `src/hooks/`, `supabase/`, testach i konfiguracji to pure-data. Ogłoś wynik jednym zdaniem; pytaj tylko, gdy po researchu nadal nie wiesz.

- Pure-data → frontmatter planu: `design_md: null`, `figma_spec: null`, `figma_screens: {}`; reszta 1.6 odpada.
- Dotyka UI → przeczytaj `references/kontekst-designerski.md` i wykonaj kroki B–F (DESIGN.md, makiety Figmy, SPEC.md, idempotentność).

Klasyfikacja jest wstępna: IU delegowany do `feature-builder-ui` lub `feature-builder-fullstack` w planie pure-data oznacza powrót do kroków B–F przed dalszym planowaniem.

### Faza 2: Pytania planistyczne

Zbierz pytania z odroczonych pytań źródła, luk z researchu i decyzji technicznych potrzebnych do planu. Każde jest **rozwiązane w planowaniu** (odpowiedź poznawalna z repo, dokumentacji albo wyboru użytkownika) albo **odroczone do implementacji** (zależy od kodu, zachowania runtime'u, odkryć w wykonaniu). Użytkownika pytasz tylko o to, co zmienia architekturę, zakres, kolejność albo ryzyko i nie da się wywnioskować. Nie uruchamiasz testów, nie budujesz aplikacji i nie badasz runtime'u.

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
- IU ze scenariuszem `[E2E]` stoi w fazie, w której istnieje wszystko, czego flow potrzebuje (strona, dane, seed).

Numeracja IU jest ciągła przez cały plan (IU-1, IU-2, …).

#### 3.4 Pola IU

Format jednostki i całego planu jest w `references/szablon-planu.md` — przeczytaj go przed pisaniem (Faza 4). Pola: Cel, Wymagania, Zależności, Pliki (tabela, 3.6), Delegate to (3.5), Skills in play, Podejście, Notatka wykonawcza (opcjonalna), Teksty (verbatim) (obowiązkowe, gdy IU renderuje zatwierdzone treści), Wzorce do naśladowania, Scenariusze testowe, Weryfikacja, Operator checklist (opcjonalna).

- **Odwołanie do decyzji niesie jej treść.** IU trafia do buildera jako osobny prompt — builder nie widzi reszty planu. Przy każdym odwołaniu dopisz zdanie treści w nawiasie: `strażnik regresji R2 (przy zmianie CTA istniejący tracking zostaje — nowy event, nie modyfikacja)`.
- **Teksty widoczne dla użytkownika** (etykiety, nagłówki, komunikaty błędów) wklejasz dosłownie w `**Teksty (verbatim):**`, nie przez odwołanie do punktu checklisty — inaczej builder wpisze własną wersję, a review zgłosi rozjazd z zamówieniem.
- **Scenariusze testowe** — każda pozycja zaczyna się typem: `[Unit]` (test kodu), `[E2E]` (flow w przeglądarce, 3.4b), `[Manual]` (krok człowieka, np. fizyczne urządzenie). Feature-bearing IU ma plik testu w tabeli plików.
- **Weryfikacja** — tylko kryteria, które scribe review domknie sam: każda pozycja ma komendę w backtickach (`pnpm typecheck`, `pnpm vitest run <ścieżka>`, `grep …`), opisaną oczekiwanym wynikiem. Runner z `e2e/` idzie wyłącznie jako `[E2E]` (3.4b) — bez znacznika scribe uruchomiłby go bez środowiska e2e. Krok człowieka idzie do `Operator checklist` albo `[Manual]`.
- **Operator checklist** — kroki człowieka po implementacji (akceptacja designera, test na urządzeniu, `supabase db push` na dev/prod po merge'u). Trafiają do sekcji operatora fazy i do smoke'u operatora przy archiwizacji.
- **Znaczniki tylko na początku pozycji.** `[E2E]`, `[Manual]`, `[Unit]`, `Operator:`, `[P1]`–`[P3]` w środku treści dokładają linię do grepów prechecku, testera i completion-gate — w treści pisz to słowami („test w przeglądarce”).

#### 3.4b Scenariusze E2E i seedy

Autonomiczne E2E działa na dedykowanym projekcie testowym z `.env.e2e`, nigdy na dev/prod. Środowisko stawia i sprząta autopilot (Vite `--mode e2e`, `supabase db push` migracji i seedów, konto `E2E_TEST_EMAIL`); tester `feature-tester-e2e` wykonuje scenariusz z opisu linii, plików flow nie ma.

- Scenariusz: `- [E2E] \`<flow>\`[ (seed: e2e/seeds/<x>-seed.sql)] — <otwórz URL, kliknij X, sprawdź Y, screenshot> → <oczekiwany stan>`; `<flow>` to stabilny kebab-case identyfikator. To jedyna linia scenariusza: db-sync bierze z niej seed, tester i scribe dopasowują przebieg po nazwie flow. Jeden flow = jedna linia w całym planie.
- `Weryfikacja: [E2E]` tylko dla runnera `.sh`, który nie jest scenariuszem (np. `e2e/run-all.sh`) — druga linia dla tego samego flow to drugi przebieg w licznikach.
- Seed jest deliverablem buildera: dane spoza stanu bazowego konta `E2E_TEST_EMAIL` i spoza istniejących seedów → wiersz `Stwórz (e2e seed)` z `e2e/seeds/<flow>-seed.sql` w tabeli plików IU; dane z istniejącego seeda → jego ścieżka w linii scenariusza. Autor seeda w bloku testera albo w Weryfikacji = seed, którego nikt nie napisze.
- Seed jest idempotentny (DELETE albo upsert) i wskazuje konto przez `(select id from auth.users where email='<E2E_TEST_EMAIL>')`, bez stałych ID; flow loguje się e-mailem i hasłem konta testowego, nigdy przez OAuth.
- Smoke RLS (odmowa nie-uczestnikowi) wykonujesz SQL-em na bazie e2e (`psql "$SUPABASE_E2E_DB_URL"`), bez Supabase MCP.
- Realtime: jeden klient (render, wysłanie, optimistic + echo) jest `[E2E]`; dwóch klientów na żywo → `[Manual]`.
- Projekt bez `.env.e2e`: scenariusz zostaje `[E2E]` tylko z pozycją setupu środowiska w checkliście (3.7); świadomy opt-out to `[Manual]`.

#### 3.5 Builder IU

`Delegate to:` = builder z `.claude/agents/`, dobrany po ścieżkach tabeli plików:

| Pliki IU | Delegate to | Skills in play |
|---|---|---|
| tylko UI: `*.tsx` w `src/components/`, `src/features/<x>/components/`, `src/pages/`, `*.css` | `feature-builder-ui` | tailwind-react-guidelines, ux-ui-guidelines |
| tylko dane: `src/lib/`, hooki danych, `src/services/`, `supabase/migrations/`, `supabase/functions/` | `feature-builder-data` | supabase-dev-guidelines, security, sentry-integration |
| UI i dane w jednej atomowej IU | `feature-builder-fullstack` | tailwind-react-guidelines, ux-ui-guidelines, supabase-dev-guidelines, security, sentry-integration |

IU, którą da się rozsądnie podzielić na UI i dane, dzielisz; `feature-builder-fullstack` zostaje dla podziału sztucznego (formularz logowania: UI bez wywołania auth i auth bez formularza są bezużyteczne). `Skills in play:` odzwierciedla `skills:` z frontmattera buildera — dokumentacyjnie, dla czytelnika planu.

Plan pisze bazowe nazwy builderów. Warianty `feature-builder-ui-figma` i `feature-builder-fullstack-figma` (z narzędziami Figma MCP i skillami Figmy) wybiera planner fazy, gdy kontekst designerski zadania ma `figma_spec` albo `figma_screens`.

#### 3.6 Tabela plików i budżet pliku

Pole `**Pliki:**` to tabela `| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |`, jeden plik na wiersz. Akcje: `Stwórz`, `Modyfikuj`, `Test (unit)`, `Stwórz (e2e seed)`.

- **Kompletność.** Tabela wymienia każdy plik, który IU stworzy lub zmieni: źródła, testy, migracje, seedy, konfigurację. Planner dobiera do promptu buildera reguły wiedzy projektu po tych ścieżkach — plik spoza tabeli to builder bez reguł dla niego.
- **Linie dziś.** Policz skryptem: `node .claude/scripts/plan/plan.mjs linie <plik> <plik>` — linie kodu jak ESLint `max-lines` (bez pustych i komentarzy). Nowy plik: `0`. Plik z wcześniejszej IU tego planu: „dziś” = jej „po”.
- **Linie po** — szacunek po zmianie IU. Obie kolumny zapisujesz liczbami całkowitymi (`120 → 180`), bez `~` i słów; plik spoza kodu (SQL, markdown) może mieć `— → —`.
- **Próg 300 linii na plik.** Plik kodu, który po zmianie przekracza 300, dostaje ocenę wymiarów w kolumnie Wymiary: powody zmiany (ile niezależnych powodów, by plik się zmieniał), eksporty między warstwami, importy z wielu domen, test-lustro (czy test da się podzielić tak jak plik), reguła 5 s (czy w 5 sekund wiesz, co plik robi). Wymiar pęknięty → werdykt `wydziel <co>` i wiersz `Stwórz` nowego modułu w tej samej IU, a „po” liczysz po wydzieleniu.
- **Próg 360 linii na plik** (300 + 20% tolerancji) to próg ESLint i bota PR: plik powyżej 360 po zmianie zawsze dostaje wydzielenie.
- Werdykt bez przekroczeń: `nowy` albo `zostaje`.

`plan.mjs sprawdz` (6.2) liczy „dziś” w repo i odrzuca tabelę z rozjazdem ponad tolerancję, plik powyżej 360, przekroczenie 300 bez wymiarów i `wydziel` bez wiersza `Stwórz`.

#### 3.6b Rejestr stałych

Sekcja planu `## Rejestr stałych` — tabela `| Stała | Wartość | Źródło | Konsumenci |` dla wartości, których używa więcej niż jedna IU albo warstwa: statusy, limity, nazwy tras, klucze zapytań, kody błędów, nazwy zdarzeń. Każda stała ma jedno źródło — plik w tabeli plików pierwszej IU, która jej używa. IU-źródło zapisuje w Podejściu definicję dosłownie (`MAKS_DLUGOSC_NOTATKI = 500` w `src/services/notatki-limity.ts`), a IU-konsumenci importują stałą stamtąd i powtarzają w Podejściu nazwę z wartością — planner fazy nie dokleja builderowi rejestru. Bez rejestru dwie IU w osobnych promptach definiują tę samą wartość dwa razy. Plan bez takich wartości: „Brak stałych współdzielonych.”

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
- Frontmatter ma `design_md`, `figma_spec`, `figma_screens`, `operator_prep` — ścieżki albo jawne `null` / `{}`; `figma_spec` i ekrany `figma_screens` istnieją na dysku. Plan z IU ui/fullstack przeszedł kroki B–C z 1.6 (`figma_spec: null` tylko jako świadoma odpowiedź „projektujemy z głowy”).
- Scenariusze są konkretne, ale nie są kodem testu; Weryfikacja wg 3.4; `[E2E]` wg 3.4b.
- „Wymagania wstępne operatora” zgadzają się z `operator_prep`; plan z `[E2E]` bez `.env.e2e` ma pozycję setupu albo opt-out do `[Manual]`.

#### 5.2 Zapis planu

`mkdir -p docs/plans/` i zapisz plan narzędziem Write do `docs/plans/YYYY-MM-DD-NNN-<type>-<feature-slug>-plan.md`. Potwierdź: `Plan zapisany do docs/plans/<plik>`.

#### 5.2b Checklista operatora

Gdy delta z 3.7 jest niepusta: uzupełnij checklistę z 0.3 narzędziem Edit albo utwórz `docs/operator/<feature-slug>-przygotowanie.md` wg `references/przygotowanie-operatora.md`. Faktyczną ścieżkę wpisz do `operator_prep:` planu. Potwierdź: `Checklista operatora: <ścieżka> (N pozycji, M z [blokuje: faza 1])`.

### Faza 6: Zadanie dla autopilota

Wynik fazy: plan bez błędów skryptu, branch `feature/<zadanie>` z commitem inicjalnym, `docs/active/<zadanie>/` i bramka gotowości. `<zadanie>` = `<feature-slug>` z nazwy pliku planu, chyba że użytkownik podał inną nazwę.

#### 6.1 Bramka E2E per scenariusz

Dla każdego scenariusza `[E2E]` w planie prześledź flow po krokach:

- **Natywne okno albo zewnętrzny system** (systemowy file picker i upload, popup OAuth, zewnętrzne okno płatności, captcha, odebranie e-maila) — agent-browser tego nie wykona i scenariusz spadnie do operatora. Dane, które przyszłyby przez upload albo zewnętrzny system, wstrzykujesz seedem albo `service_role` na bazie e2e i asertujesz render; logowanie zawsze e-mailem i hasłem konta `E2E_TEST_EMAIL`; krok nie do obejścia → `[Manual]` w Operator checklist IU.
- **Dane spoza stanu bazowego** konta `E2E_TEST_EMAIL` (nowe rekordy, relacje, uprawnienia) → w IU jest wiersz `Stwórz (e2e seed)` albo ścieżka istniejącego seeda w linii scenariusza (`(seed: e2e/seeds/<x>-seed.sql)`).

Zatrzymujesz się i pytasz tylko przy: (a) scenariuszu bez identyfikatora flow albo bez wykonalnych kroków — domyślna propozycja to dopisanie flow i kroków do planu, `[Manual]` jako świadomy opt-out; (b) flow z natywnym oknem lub zewnętrznym systemem bez obejścia seedem; (c) danych spoza stanu bazowego bez seeda. Poprawki wprowadzasz w planie technicznym.

#### 6.2 Walidacja planu skryptem

```bash
node .claude/scripts/plan/plan.mjs sprawdz <docs/plans/plik-planu.md>
```

Wynik JSON: `bledy` i `uwagi` z numerami linii i identyfikatorami IU. Każdy błąd poprawiasz w planie technicznym (Edit) i uruchamiasz `sprawdz` ponownie, aż `ok: true`. Skrypt opisuje kontrakt konsumentów zadania — poprawiasz plan, nie skrypt. Uwagi (origin bez pliku, migracja w opisie bez pliku w `supabase/migrations/`, luka w numeracji IU) pokazujesz użytkownikowi w handoffie.

#### 6.3 Git i branch

1. `git status --short --untracked-files=all` i podział pozycji:
   - **(a) artefakty planowania** pod `docs/plans/`, `docs/operator/`, `docs/brainstorms/` — stan oczekiwany; zapamiętaj listę ścieżek do commitu inicjalnego (`git checkout -b` przenosi je na nowy branch, więc plan ląduje na `feature/<zadanie>`, nie na `main`);
   - **(b) każda inna pozycja** (kod, `e2e/`, `.env*`, `package.json`, inne docs) → stop i pytanie: zacommitować te pliki na bieżącym branchu, schować je (`git stash push -u -- <ścieżki z (b)>` — gołe `git stash` nie chowa nieśledzonych, a `-u` bez ścieżek schowałby też plan) albo przerwać. Ścieżek z (a) nie stashujesz i nie commitujesz na `main`.
2. Branch: `git branch --show-current` = `feature/<zadanie>` → zostajesz; `git branch --list feature/<zadanie>` niepuste → najpierw sprawdź, czy to nie gałąź zakończonego zadania o tym samym slugu (`git merge-base --is-ancestor feature/<zadanie> main` albo istniejące `docs/completed/<zadanie>/`) — wtedy zapytaj o inną nazwę zadania; inaczej `git checkout feature/<zadanie>`; brak gałęzi → `git checkout -b feature/<zadanie>` z `main` albo `develop` (z innego brancha — zapytaj).

#### 6.4 Pliki zadania

```bash
node .claude/scripts/plan/plan.mjs generuj <docs/plans/plik-planu.md> --zapisz [--nazwa <zadanie>]
```

Skrypt zapisuje `docs/active/<zadanie>/<zadanie>-plan.md`, `-kontekst.md` i `-zadania.md` i zwraca liczniki (fazy, IU, checkboxy implementacyjne, `Test:`, `Weryfikacja:`, `[E2E]`, pozycje operatora). Plików zadania nie piszesz ani nie poprawiasz ręcznie — zmiana idzie przez plan i ponowne `generuj`. Odmowa „katalog zadania już istnieje” przy wznowieniu bez przebiegu autopilota → `--nadpisz`; odmowa z powodu przebiegu (stan autopilota, raport review, odhaczone pozycje, wpisy dziennika) → pokaż ją i zapytaj, jak dalej.

#### 6.5 Commit inicjalny

`git add docs/active/<zadanie>/` plus dokładnie ścieżki z 6.3 (a): plan techniczny, `docs/plans/<feature-slug>-figma/`, checklista z `operator_prep:` (dokładna ścieżka z frontmattera), zmieniony dokument źródłowy. Bez `git add -A` i bez całego `docs/plans/`. Commit: `docs: inicjalizacja planu dla <zadanie>`.

#### 6.6 Bramka gotowości

```bash
node .claude/scripts/plan/plan.mjs gotowosc docs/active/<zadanie>
```

Wynik ma cztery pozycje, każdą wypisujesz w handoffie:

- `plan` — błędy strukturalne planu technicznego (po 6.2 zwykle puste);
- `e2e` — scenariusze `[E2E]` i makiety `figma_screens` vs środowisko: to samo sprawdzenie co bootstrap autopilota (`.env.e2e` w `.gitignore`, klucze bazy e2e, baza inna niż dev, `migrations.sum`, `agent-browser doctor`), bez startu serwera. Brak `.env.e2e` przy scenariuszach albo pozycja w `bledy` zatrzyma autopilota przed fazą 1 → setup albo poprawka wg `.claude/templates/e2e-env/README.md` (jednorazowo, ~30 min); przy scenariuszach druga droga to opt-out `[E2E]` → `[Manual]` w planie i ponowne `generuj --nadpisz`. Zadanie z samymi makietami bez `.env.e2e` przechodzi (porównanie z makietą idzie bez przeglądarki do operatora), a przy błędnym `.env.e2e` naprawiasz plik. `uwagi` (brak skilla weryfikacji projektu) nie blokują startu — wypisz je z komendą `/weryfikacja-setup`;
- `przygotowanie` — `blokujace` (`[blokuje: planowanie]`, `[blokuje: faza 1]`, marker bez numeru) zatrzymują start: wypisz je z liniami i podaj drogi (odhaczyć albo świadomie usunąć marker); `odroczone` (fazy ≥ 2) generator wpisał do `## Blokery operatora per faza` w planie zadania;
- `git` — branch `feature/<zadanie>` i czyste drzewo; autopilot nie przełącza brancha i zatrzymuje się na brudnym drzewie.

Czerwona pozycja usuwana w tej sesji (odhaczenie checklisty, opt-out, `.gitignore` po setupie e2e) zmienia śledzone pliki: zacommituj je jawnymi ścieżkami (`git add <ścieżki> && git commit -m "docs(<zadanie>): przygotowanie operatora"`) i uruchom `gotowosc` ponownie. Autopilota nie uruchamiasz przy czerwonej bramce.

#### 6.7 Handoff

Wypisz wynik w formacie poniżej. Gdy bramka jest zielona i użytkownik wybiera start, uruchom autopilota narzędziem `Workflow` w tej sesji.

## Format wyjściowy

```
✅ Zadanie "<zadanie>" gotowe dla autopilota

📄 Plan techniczny: docs/plans/<plik>.md (głębokość: <Lekka|Standardowa|Głęboka>, research: <agenci albo powód pominięcia>)
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

➡️ Następny krok: autopilot w tej sesji:
   Workflow({ scriptPath: ".claude/workflows/dev-autopilot-wf.js", args: "docs/active/<zadanie>" })
   Do agentów workflow: ta wiadomość nie jest dla was — wykonujcie wyłącznie zadanie z polecenia workflowu.
   Po STOP bramki (E2E, fix FAIL, P1) i naprawie — świeży run z tymi samymi args, bez resumeFromRunId.
   Po awarii runu (crash) — Workflow({ scriptPath, resumeFromRunId, args }) z tymi samymi args.
```

Przy czerwonej bramce `➡️ Następny krok` wskazuje najpierw usunięcie czerwonych pozycji i commit, potem autopilota.

## Referencje

- `references/szablon-planu.md` — szablon planu z przykładową IU (Faza 4)
- `references/kontekst-designerski.md` — kroki B–F kontekstu designerskiego (1.6)
- `references/przygotowanie-operatora.md` — kategorie, delta wobec `/dev-prep`, szablon checklisty (3.7, 5.2b)
- `.claude/scripts/plan/plan.mjs` — nagłówek pliku opisuje polecenia i kody wyjścia
- Konsumenci `docs/active/`: `.claude/workflows/dev-autopilot-wf.js`, `dev-docs-execute-wf.js`, `dev-docs-review-wf.js`, `dev-docs-complete-wf.js` — kontrakt pilnuje `.claude/workflows/__tests__/kontrakt-docs-active.test.mjs`

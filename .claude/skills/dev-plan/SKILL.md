---
name: dev-plan
description: "Planowanie techniczne implementacji z Implementation Units."
argument-hint: "[opcjonalnie: ścieżka do requirements doc lub opis feature'a]"
---

# Stwórz plan techniczny

**Uwaga: Aktualny rok to 2026.** Używaj tego przy datowaniu planów i wyszukiwaniu dokumentacji.

`/dev-brainstorm` (opcjonalny — tylko gdy wymagania nie istnieją) definiuje **CO** budować. `/dev-plan` definiuje **JAK** to zbudować. `/dev-docs` tnie plan na fazy i zadania w `docs/active/`, a `dev-autopilot-wf` je wykonuje.

Ten workflow produkuje trwały plan implementacji. **Nie** implementuje kodu, nie uruchamia testów, nie uczy się z wyników runtime'u. Jeśli odpowiedź zależy od zmiany kodu i zobaczenia co się stanie, to należy do fazy wykonania (autopilot / `/dev-docs-execute`), nie tutaj.

Plan jest **jedynym** źródłem treści dla `/dev-docs` — to, czego nie ma w planie (fazy, pliki, scenariusze, wymagania wstępne operatora), nie pojawi się w zadaniach autopilota.

## Metoda interakcji

Używaj narzędzia pytań platformy gdy dostępne. Przy zadawaniu pytań użytkownikowi preferuj blokujące narzędzie pytań platformy (`AskUserQuestion` w Claude Code). W przeciwnym razie prezentuj numerowane opcje w chacie i czekaj na odpowiedź.

Zadawaj jedno pytanie na raz. Preferuj zwięzły single-select gdy istnieją naturalne opcje.

## Opis feature'a

<feature_description> #$ARGUMENTS </feature_description>

**Jeśli opis powyżej jest pusty:** przeszukaj `docs/brainstorms/` w poszukiwaniu plików `*-requirements.md`. Jeśli znajdziesz relevantny dokument, użyj go jako inputu. Jeśli nie znajdziesz, zapytaj: "Co chciałbyś zaplanować? Opisz feature, bug fix lub usprawnienie."

Nie kontynuuj dopóki nie masz jasnego inputu do planowania.

**Słownik domenowy:** jeśli istnieje `docs/CONCEPTS.md`, przeczytaj go najpierw — to glosariusz pojęć o projektowo-specyficznym znaczeniu. Używaj tej terminologii w planie i NIE planuj zmian sprzecznych z definicjami (np. „naprawy" statusu, który celowo działa nietypowo).

## Główne zasady

1. **Używaj wymagań jako źródła prawdy** — jeśli `/dev-brainstorm` wyprodukował requirements doc, planowanie powinno na nim bazować zamiast wymyślać zachowania od nowa.
2. **Decyzje, nie kod** — zapisuj podejście, granice, pliki, zależności, ryzyka i scenariusze testowe. Nie pisz kodu implementacji ani sekwencji komend shellowych.
3. **Research przed strukturowaniem** — eksploruj codebase, wiedzę instytucjonalną i guidance zewnętrzny gdy jest to uzasadnione, zanim sfinalizujesz plan.
4. **Dopasuj rozmiar artefaktu** — mała praca dostaje kompaktowy plan. Duża praca dostaje więcej struktury. Filozofia pozostaje ta sama na każdym poziomie.
5. **Oddziel planowanie od odkryć wykonawczych** — rozwiązuj pytania planistyczne tutaj. Explicite odraczaj niewiadome wykonawcze do implementacji.
6. **Plan musi być przenośny** — plan powinien działać jako żywy dokument, artefakt do review lub ciało issue bez osadzania instrukcji specyficznych dla narzędzi.
7. **Lekko sygnalizuj postawę wykonawczą gdy to ma znaczenie** — jeśli request, dokument źródłowy lub kontekst repo jasno implikują test-first, characterization-first lub inną niestandardową postawę wykonawczą, odzwierciedl to w planie jako lekki sygnał. Nie zamieniaj planu w krok-po-kroku choreografię wykonania.

## Pasek jakości planu

Każdy plan powinien zawierać:
- Jasne ujęcie problemu i granicę scope'u
- Konkretną traceability wymagań z powrotem do requestu lub dokumentu źródłowego
- Dokładne ścieżki plików dla proponowanej pracy
- Explicite ścieżki plików testowych dla feature-bearing implementation units
- Decyzje z uzasadnieniem, nie tylko zadania
- Istniejące wzorce lub referencje do kodu do naśladowania
- Konkretne scenariusze testowe i oczekiwane wyniki weryfikacji
- Jasne zależności i sekwencjonowanie

Plan jest gotowy gdy implementator może zacząć pewnie bez potrzeby żeby plan pisał za niego kod.

## Przebieg

### Faza 0: Wznowienie, źródło i scope

#### 0.1 Wznów istniejącą pracę nad planem gdy to sensowne

Jeśli użytkownik odnosi się do istniejącego pliku planu lub istnieje oczywisty niedawny pasujący plan w `docs/plans/`:
- Przeczytaj go
- Potwierdź czy aktualizować go w miejscu czy stworzyć nowy plan
- Przy aktualizacji: zachowaj zaznaczone checkboxy i zrewiduj tylko wciąż relevantne sekcje

#### 0.2 Znajdź upstream requirements doc

Przed zadawaniem pytań planistycznych przeszukaj `docs/brainstorms/` w poszukiwaniu dokumentu źródłowego. Pełnoprawnym źródłem wymagań jest **każda** z tych form — nie tylko plik wyprodukowany przez `/dev-brainstorm`:

1. **Requirements doc per feature** — `docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md` (output `/dev-brainstorm`).
2. **Zbiorczy dokument wymagań projektu** — np. `docs/brainstorms/mvp-requirements.md`, roadmapa etapów, PRD całego produktu. Dokumentem źródłowym jest wtedy **sekcja / etap** pasujący do feature'a (plus sekcje „decyzje obowiązujące" / „ustalenia", jeśli dokument je ma). W `origin:` frontmattera wpisz ścieżkę z kotwicą sekcji (`docs/brainstorms/mvp-requirements.md#etap-17`), a w planie cytuj identyfikatory wymagań z tej sekcji.
3. **Wymagania podane wprost w requeście** — lista poprawek z feedbacku (R1…Rn), odpowiedzi interesariusza na pytania, wynik audytu. Traktuj treść requestu jak dokument źródłowy: nadaj wymaganiom stabilne ID (R1…), jeśli ich nie mają, i przenieś je do „Śledzenie wymagań".

**Kryteria trafności:** dokument jest trafny jeśli:
- Temat semantycznie pasuje do opisu feature'a
- Wydaje się pokrywać ten sam problem użytkownika lub scope
- Dla dokumentów per feature: został stworzony w ciągu ostatnich 30 dni (użyj rozsądku, gdy dokument jest wyraźnie wciąż trafny lub wyraźnie nieaktualny). **Dokumentów żywych (zbiorczych, aktualizowanych na bieżąco) limit 30 dni nie dotyczy** — liczy się data ostatniej aktualizacji sekcji, nie data utworzenia pliku.

Jeśli wiele dokumentów źródłowych pasuje, zapytaj którego użyć używając narzędzia pytań platformy gdy dostępne. W przeciwnym razie prezentuj numerowane opcje w chacie i czekaj na odpowiedź.

**Katalog nie jest kontraktem — fallback zamiast cichego bootstrapu.** `docs/brainstorms/` to konwencja szablonu, nie gwarancja: projekt mógł zapisać brainstorm gdzie indziej (np. `docs/dev-brainstorms/`). Gdy glob `docs/brainstorms/*.md` nic nie zwraca (albo katalog nie istnieje), zrób fallback: glob `docs/**/*-requirements.md` + katalogi w `docs/` o nazwie zawierającej `brainstorm` (z pominięciem `docs/plans/`, `docs/active/`, `docs/completed/`, `docs/solutions/`, `docs/operator/`). Trafienie → traktuj jak dokument źródłowy i ogłoś nietypową lokalizację jednym zdaniem. **Nigdy nie przechodź w planning bootstrap w milczeniu**: gdy i fallback nic nie znajdzie, zapytaj przez `AskUserQuestion` („Nie znalazłem requirements doc — podaj ścieżkę albo potwierdź, że planujemy bez dokumentu źródłowego"), zanim uznasz, że dokumentu nie ma. Cichy bootstrap gubi istniejący brainstorm — użytkownik dowiaduje się o tym dopiero, gdy plan nie pokrywa jego wymagań.

**Operator checklist etapu (`/dev-prep`).** Po ustaleniu dokumentu źródłowego zrób glob `docs/operator/*.md` (z pominięciem `*-smoke.md`) i sprawdź **frontmattery**, czy któryś ma `origin:` wskazujący ten sam etap/dokument. **Szukaj po frontmatterze, nie po nazwie pliku** — `/dev-prep` dziedziczy konwencję nazewniczą zastanej serii checklist, więc plik może się nazywać `e3-operator-checklist.md` równie dobrze jak `<slug>-przygotowanie.md`. Jeśli znajdziesz:

- Przeczytaj go w całości i przyjmij jego `feature_slug:` jako `<feature-slug>` na cały przebieg (1.6, 3.1, 5.2b) — **nie wymyślaj własnego slugu**.
- To jest **ten sam plik**, który uzupełnisz w 5.2b. Nie twórz drugiego dokumentu przygotowawczego — sekcja 3.7 dopisuje do tego.
- Sekcja „Makiety" (z wklejonymi URL-ami Figmy) jest inputem dla 1.6 kroku C; „Decyzje" dla 0.5; „Konta, konsole, sekrety" i „Assety" dla 3.7.
- Ogłoś jednym zdaniem: „Znalazłem operator checklist etapu: `<ścieżka>` (N pozycji, M nieodhaczonych) — używam go jako źródła kontekstu designerskiego i wymagań operatora; uzupełnię go po zbudowaniu IU."
- **Nieodhaczone pozycje `[blokuje planowanie]`** wymień i zapytaj przez `AskUserQuestion`, czy planować mimo to (wybór świadomy — plan powstanie z lukami), czy przerwać do czasu ich domknięcia.

Brak takiego dokumentu jest w pełni poprawny — kontynuuj standardowym przebiegiem (1.6 zapyta o Figmę interaktywnie, 5.2b utworzy krótką listę od zera). Nie wymagaj `/dev-prep` i nie przerywaj planowania z powodu jego braku.

#### 0.3 Użyj dokumentu źródłowego jako głównego inputu

Jeśli relevantny requirements doc istnieje:
1. Przeczytaj go dokładnie
2. Ogłoś że posłuży jako dokument źródłowy do planowania
3. Przenieś dalej wszystko z następujących:
   - Ujęcie problemu
   - Wymagania i kryteria sukcesu
   - Granice scope'u
   - Kluczowe decyzje i uzasadnienie
   - Zależności lub założenia
   - Otwarte pytania, zachowując czy są blokujące czy odroczone
4. Użyj dokumentu źródłowego jako głównego inputu do planowania i researchu
5. Odwołuj się do ważnych przeniesionych decyzji w planie z `(zob. źródło: <ścieżka-źródła>)`
6. Nie pomijaj cicho treści źródłowej — jeśli dokument źródłowy to omawiał, plan musi to zaadresować choćby krótko. Przed finalizacją przeskanuj każdą sekcję dokumentu źródłowego żeby zweryfikować że nic nie zostało pominięte.

Jeśli nie istnieje relevantny requirements doc, planowanie może kontynuować bezpośrednio z requestu użytkownika.

#### 0.4 Fallback bez requirements doc

Jeśli nie istnieje relevantny dokument źródłowy w żadnej z form z 0.2:
- Oceń czy request jest już wystarczająco jasny do bezpośredniego planowania technicznego
- Jeśli niejednoznaczność dotyczy głównie ujęcia produktu, zachowań użytkownika lub definicji scope'u, zarekomenduj najpierw `/dev-brainstorm`. **Nie rekomenduj brainstormu** dla bugów, tech-debtu, poprawek z listy ani zadań „jak w istniejącym wzorcu" — tam brakuje co najwyżej decyzji technicznych, które rozstrzyga planning bootstrap
- Jeśli użytkownik chce kontynuować tutaj, uruchom krótki planning bootstrap zamiast odmawiać

Planning bootstrap powinien ustalić:
- Ujęcie problemu
- Zamierzone zachowanie
- Granice scope'u i oczywiste non-goals
- Kryteria sukcesu
- Blokujące pytania lub założenia

Bootstrap powinien być krótki. Istnieje żeby zachować wygodę bezpośredniego wejścia, nie żeby zastępować pełny brainstorm.

Jeśli bootstrap odkryje duże nierozwiązane pytania produktowe:
- Zarekomenduj `/dev-brainstorm` ponownie
- Jeśli użytkownik wciąż chce kontynuować, wymagaj explicite założeń przed kontynuacją

#### 0.5 Sklasyfikuj otwarte pytania przed planowaniem

Jeśli dokument źródłowy zawiera `Do rozwiązania przed planowaniem` lub podobne blokujące pytania:
- Przejrzyj każde przed kontynuacją
- Przeklasyfikuj do pracy planistycznej **tylko jeśli** jest to faktycznie pytanie techniczne, architektoniczne lub badawcze
- Zachowaj jako bloker jeśli zmieniłoby zachowanie produktu, scope lub kryteria sukcesu

Jeśli prawdziwe blokery produktowe pozostają:
- Surfuj je jasno
- Zapytaj użytkownika czy:
  1. Wznowić `/dev-brainstorm` żeby je rozwiązać
  2. Przekonwertować w explicite założenia lub decyzje i kontynuować
- Nie kontynuuj planowania gdy prawdziwe blokery pozostają nierozwiązane

#### 0.6 Oceń głębokość planu

Sklasyfikuj pracę w jedną z tych głębokości:

- **Lekka** — mała, dobrze ograniczona, niska niejednoznaczność
- **Standardowa** — normalny feature lub bounded refactor z kilkoma decyzjami technicznymi do udokumentowania
- **Głęboka** — cross-cutting, strategiczna, high-risk lub bardzo niejednoznaczna praca implementacyjna

Jeśli głębokość jest niejasna, zadaj jedno celowane pytanie i kontynuuj.

### Faza 1: Zbierz kontekst

#### 1.1 Research lokalny (uruchamiany zawsze)

Przygotuj zwięzłe podsumowanie kontekstu planowania (akapit lub dwa) jako input do agentów badawczych:
- Jeśli dokument źródłowy istnieje, podsumuj ujęcie problemu, wymagania i kluczowe decyzje z tego dokumentu
- W przeciwnym razie użyj bezpośrednio opisu feature'a

Uruchom tych agentów równolegle:

- Agent tool (type: Explore) z promptem z `.claude/agents/repo-research-analyst.md` — przekaż podsumowanie kontekstu planowania
- Agent tool (type: Explore) z promptem z `.claude/agents/learnings-researcher.md` — przekaż podsumowanie kontekstu planowania

Zbierz:
- Istniejące wzorce i konwencje do naśladowania
- Relevantne pliki, moduły i testy
- Guidance z CLAUDE.md które materialnie wpływa na plan
- Wiedzę instytucjonalną z `docs/solutions/`

#### 1.1b Wykryj sygnały postawy wykonawczej

Zdecyduj czy plan powinien nieść lekki sygnał postawy wykonawczej.

Szukaj sygnałów takich jak:
- Użytkownik explicite prosi o TDD, test-first lub characterization-first
- Dokument źródłowy wymaga test-first implementacji lub eksploracyjnego hardening'u legacy kodu
- Research lokalny pokazuje że docelowy obszar jest legacy, słabo przetestowany lub historycznie kruchy, sugerując characterization coverage przed zmianą zachowania

Gdy sygnał jest jasny, przenieś go cicho w relevantnych implementation units.

Pytaj użytkownika tylko jeśli postawa materialnie zmieniłaby sekwencjonowanie lub ryzyko i nie może być odpowiedzialnie wywnioskowana.

#### 1.2 Zdecyduj o researchu zewnętrznym

Na podstawie dokumentu źródłowego, sygnałów użytkownika i wyników lokalnych zdecyduj czy research zewnętrzny dodaje wartość.

**Czytaj między wierszami.** Zwróć uwagę na sygnały z dotychczasowej rozmowy:
- **Znajomość użytkownika** — czy wskazuje na konkretne pliki lub wzorce? Prawdopodobnie dobrze zna codebase.
- **Intencja użytkownika** — czy chce szybkości czy dokładności? Eksploracji czy wykonania?
- **Ryzyko tematu** — bezpieczeństwo, płatności, zewnętrzne API wymagają więcej ostrożności niezależnie od sygnałów użytkownika.
- **Poziom niepewności** — czy podejście jest jasne czy wciąż otwarte?

**Zawsze skłaniaj się ku researchowi zewnętrznemu gdy:**
- Temat jest high-risk: bezpieczeństwo, płatności, prywatność, zewnętrzne API, migracje, compliance
- Codebase nie ma relevantnych lokalnych wzorców
- Użytkownik eksploruje nieznany teren

**Pomiń research zewnętrzny gdy:**
- Codebase już pokazuje silny lokalny wzorzec
- Użytkownik już zna zamierzony kształt
- Dodatkowy kontekst zewnętrzny dodałby mało praktycznej wartości

Ogłoś decyzję krótko przed kontynuacją. Przykłady:
- "Twój codebase ma solidne wzorce do tego. Kontynuuję bez researchu zewnętrznego."
- "To dotyczy przetwarzania płatności, więc najpierw zbadamy aktualne best practices."

#### 1.3 Research zewnętrzny (warunkowy)

Jeśli krok 1.2 wskazuje że research zewnętrzny jest przydatny, uruchom tych agentów równolegle:

- Agent tool (type: Explore) z promptem z `.claude/agents/best-practices-researcher.md` — przekaż podsumowanie kontekstu planowania
- Agent tool (type: Explore) z promptem z `.claude/agents/framework-docs-researcher.md` — przekaż podsumowanie kontekstu planowania

#### 1.4 Konsoliduj research

Podsumuj:
- Relevantne wzorce codebase'u i ścieżki plików
- Relevantną wiedzę instytucjonalną
- Referencje zewnętrzne i best practices, jeśli zebrane
- Powiązane issues, PR-y lub prior art
- Ograniczenia które powinny materialnie kształtować plan

#### 1.5 Analiza flow i edge-cases (warunkowa)

Dla planów **Standardowych** lub **Głębokich**, lub gdy kompletność user flow jest wciąż niejasna, uruchom:

- Agent tool (type: Explore) z promptem z `.claude/agents/spec-flow-analyzer.md` — przekaż podsumowanie kontekstu planowania i wyniki researchu

Użyj outputu do:
- Identyfikacji brakujących edge cases, przejść stanów lub luk w handoff'ach
- Zaostrzenia requirements trace lub strategii weryfikacji
- Dodania tylko tych szczegółów flow które materialnie poprawiają plan

#### 1.6 Kontekst designerski (warunkowy — UI features)

Cel: zanim ułożysz Implementation Units, ustal **źródło prawdy o designie** dla tego feature'a. Bez tego buildery UI dostaną tylko opis tekstowy i będą halucynować pomiary.

Ustal już teraz roboczo `<feature-slug>` = `<descriptive-name>` (kebab-case, 3-5 słów), którego użyjesz **bez zmian** w 3.1 (nazwa pliku planu), w `docs/plans/<feature-slug>-figma/` i w 5.2b (nazwa pliku checklisty, o ile nie dziedziczy konwencji serii). Jeśli 0.2 znalazło dokument `/dev-prep`, slug jest już ustalony — weź `feature_slug:` z jego frontmattera i nie twórz nowego.

**Krok A — Klasyfikacja feature'a (bez pytania użytkownika).** Ustal sam, czy feature dotyka warstwy UI, na podstawie dokumentu źródłowego i researchu z 1.1 — tą samą regułą ścieżek co tabela w 3.5:

- **Dotyka UI**, jeśli wymagania opisują ekrany/strony, komponenty, layouty, nawigację, animacje, stany widoczne dla użytkownika, **lub** research wskazuje pliki do modyfikacji w `src/components/`, `src/features/`, `src/pages/`, `*.css`.
- **Pure-data**, jeśli praca zamyka się w `src/lib/`, `src/hooks/`, `supabase/migrations/`, `supabase/functions/`, testach, konfiguracji narzędzi.

Klasyfikacja jest **wstępna** — ostateczną weryfikacją są ścieżki w `Pliki:` IU (3.4/3.5); rozjazd = powrót do kroku B. Ogłoś wynik jednym zdaniem (np. „Feature dotyka UI — strona profilu i komponent steppera; sprawdzam kontekst designerski."). Zapytaj przez `AskUserQuestion` **tylko** gdy po researchu nadal nie wiesz (np. wymaganie „popraw wydajność listy" może oznaczać zarówno zapytanie, jak i wirtualizację komponentu).

Jeśli **pure-data** → pomiń resztę sekcji 1.6, w frontmatter planu (4.2) wstaw `design_md: null`, `figma_spec: null`, `figma_screens: {}`.

Jeśli **dotyka UI** → kontynuuj krok B.

**Krok B — Projektowy DESIGN.md.** Sprawdź czy istnieje `docs/DESIGN.md` (Read tool). 

- Jeśli istnieje → zapisz ścieżkę do późniejszego frontmatera planu jako `design_md: ./docs/DESIGN.md` i ogłoś: "Używam `docs/DESIGN.md` jako źródła prawdy o tokenach designu projektu."
- Jeśli **nie istnieje** → zadaj `AskUserQuestion`:

  > "Brak `docs/DESIGN.md` (projekt-wide design system w formacie Google Labs design.md — YAML tokeny + markdown prose). Co robimy?"

  Opcje:
  1. `Stwórz teraz — zatrzymaj planowanie` (rekomendowane) — wyjdź z dev-plan, poinstruuj usera żeby stworzył `docs/DESIGN.md` (spec: https://github.com/google-labs-code/design.md). Plan można wznowić później.
  2. `Pomiń dla tej iteracji` — kontynuuj bez `DESIGN.md`, zapisz `design_md: null` w frontmatter, dodaj do "Otwarte pytania → Odroczone do implementacji" wpis: "Brak `docs/DESIGN.md` — buildery UI bazują tylko na ux-ui-guidelines i SPEC per-feature. Utwórz przed kolejnym UI feature'em."

**Krok C — Mockupy Figmy dla tej iteracji.** Kolejność sprawdzeń (pierwsze trafienie wygrywa):
1. **Istniejący SPEC** — zrób glob `docs/plans/*-figma/SPEC.md`; jeśli którykolwiek folder odpowiada temu feature'owi (ten sam `fileKey` Figmy w nagłówku SPEC, pokrywająca się nazwa lub ten sam dokument źródłowy) → przyjmij jego slug jako `<feature-slug>` i przejdź do **kroku F** — niezależnie od tego, czy linki są w źródle (rerun nie może nadpisać SPEC bez zgody).
2. **Operator checklist z `/dev-prep`** — jeśli 0.2 znalazło checklistę tego etapu, jej sekcja „Makiety" jest listą ekranów tej iteracji. Rozstrzygnij po wypełnieniu pól `URL Figma:`:
   - **Wszystkie ekrany mają URL** → przejdź wprost do kroku D **bez pytania**; listę `{name, url}` bierzesz z dokumentu, nie od użytkownika (`name` = nazwa ekranu z sekcji, bez zmian — to ona wiąże makietę z pozycją checklisty).
   - **Część ekranów ma URL** → wymień nazwy ekranów bez URL-a i zapytaj przez `AskUserQuestion`: `Fetchuj gotowe, resztę zaprojektujemy z głowy` / `Podam brakujące URL-e teraz` / `Przerywam — dokończę makiety`. Przy pierwszej opcji zapisz brakujące ekrany do „Otwarte pytania → Odroczone do implementacji".
   - **Żaden ekran nie ma URL-a, a sekcja jest niepusta** → makiety zamówione, ale niegotowe. Zapytaj: `Projektujemy z głowy w oparciu o DESIGN.md` / `Przerywam planowanie do czasu makiet` (rekomendowane, gdy pozycje mają **[blokuje planowanie]**).
   - **Sekcja pusta lub `dotyka_ui: false`** → `figma_spec: null`, `figma_screens: {}`, kontynuuj do Fazy 2.
3. **Linki w źródle** — użytkownik podał URL-e `figma.com/design/...` w requeście lub dokumencie źródłowym → przejdź wprost do kroku D bez pytania.
4. W pozostałych przypadkach zadaj `AskUserQuestion` (to jedyne pytanie designerskie, które skill zadaje w standardowym przebiegu):

> "Czy masz w Figmie mockupy ekranów dla tej iteracji?"

Opcje: `Tak — podam linki` / `Nie — projektujemy z głowy w oparciu o DESIGN.md`.

Jeśli **Nie** → wstaw `figma_spec: null`, `figma_screens: {}` w frontmatter, kontynuuj do Fazy 2.

Jeśli **Tak** → kontynuuj krok D.

**Krok D — Zbierz linki Figma (jeden per ekran).** Zadaj wolnotekstowo:

> "Podaj URL-e Figma per ekran/komponent (jeden na linię, format `<nazwa>: <url>`). Przykład:
> ```
> home-dashboard: https://figma.com/design/abc123/...?node-id=378-43
> bottom-nav: https://figma.com/design/abc123/...?node-id=27-119
> ```"

Sparsuj odpowiedź na listę `{name, fileKey, nodeId}` (z URL Figmy: `figma.com/design/<fileKey>/...?node-id=<nodeId>` — zamień `-` na `:` w nodeId).

**Krok E — Fetch i wygeneruj SPEC.md.** Dla każdego ekranu wywołaj **sekwencyjnie** (Figma MCP rate limit):

1. `mcp__plugin_figma_figma__get_design_context` z `fileKey` + `nodeId` — pobierz pełną hierarchię, pomiary, paddingi, typografię, autoLayout.
2. `mcp__plugin_figma_figma__get_variable_defs` z `fileKey` + `nodeId` — pobierz tokeny (kolory, spacing, font tokens) używane w tym frame.
3. `mcp__plugin_figma_figma__get_screenshot` z `fileKey` + `nodeId` — pobierz PNG. Zapisz jako `docs/plans/<feature-slug>-figma/<name>.png`.
4. Odczytaj `width` i `height` z metadata frame'a (z odpowiedzi `get_design_context`) — to viewport designu dla tego ekranu.

Przed jakimkolwiek zapisem sprawdź istnienie `docs/plans/<feature-slug>-figma/` — jeśli folder istnieje, a użytkownik nie wybrał w kroku F `Re-fetch i nadpisz`, zatrzymaj się i przejdź do kroku F. Po zebraniu danych ze wszystkich ekranów stwórz **jeden** plik `docs/plans/<feature-slug>-figma/SPEC.md` z układem:

```markdown
# <Feature> — Specyfikacja Figma

> Pomiary zfetchowane z Figmy YYYY-MM-DD (`get_design_context` + `get_variable_defs`).
> Źródło: Figma `<fileKey>`.

## Screeny referencyjne

| Nazwa | Plik | Wymiary | Frame |
|---|---|---|---|
| <name> | `./<name>.png` | <W>×<H>px | `<nodeId>` |
| ... | ... | ... | ... |

## Tokeny (Figma variables → mapowanie na `docs/DESIGN.md` lub `global.css @theme {}`)

[Z `get_variable_defs` — tabela `figma_variable | hex | token w projekcie`. Sprawdź czy istnieje w `docs/DESIGN.md`; oznacz brakujące jako "do dodania w DESIGN.md".]

## <NAZWA EKRANU 1> (`<nodeId>`) — pełny ekran

[Z `get_design_context` — sekcja per komponent z paddingami, fontami, kolorami, autoLayoutem. Lustruj strukturę frame'a 1:1.]

## <NAZWA EKRANU 2> (`<nodeId>`) — ...

[...]

## Rozjazdy vs DESIGN.md — Figma jest źródłem prawdy

[Tabela: element | DESIGN.md mówi | Figma mówi | decyzja. Jeśli brak rozjazdów — zostaw sekcję pustą z komentarzem "Brak rozjazdów na moment fetchu".]
```

Po zapisie plików wpisz do frontmatter planu (4.2):

```yaml
figma_spec: ./docs/plans/<feature-slug>-figma/SPEC.md
figma_screens:
  <name-1>: ./docs/plans/<feature-slug>-figma/<name-1>.png
  <name-2>: ./docs/plans/<feature-slug>-figma/<name-2>.png
```

**Krok F — Idempotentność.** Jeśli `docs/plans/<feature-slug>-figma/SPEC.md` **już istnieje** (rerun dev-plan na tym samym slug), zadaj `AskUserQuestion`:

> "SPEC.md już istnieje. Co robimy?"

Opcje:
1. `Re-fetch i nadpisz` — pociągnij świeże dane z Figmy, nadpisz SPEC i PNG. Identyfikatory weź z tabeli „Screeny referencyjne" istniejącego SPEC (`fileKey` z nagłówka, `nodeId` z kolumny Frame); gdy w źródle są nowe linki albo tabela jest niepełna → wykonaj krok D, potem E.
2. `Użyj istniejący` (rekomendowane jeśli nic nie zmieniło się w Figmie) — pomiń kroki E, użyj ścieżek z istniejącego folderu.

NIGDY nie nadpisuj bez explicit zgody usera (memory: confirm-before-delete).

### Faza 2: Rozwiąż pytania planistyczne

Zbuduj listę pytań planistycznych z:
- Odroczonych pytań z dokumentu źródłowego
- Luk odkrytych w researchu repo lub zewnętrznym
- Decyzji technicznych wymaganych do wyprodukowania użytecznego planu

Dla każdego pytania zdecyduj czy powinno być:
- **Rozwiązane podczas planowania** — odpowiedź jest poznawalna z kontekstu repo, dokumentacji lub wyboru użytkownika
- **Odroczone do implementacji** — odpowiedź zależy od zmian w kodzie, zachowania runtime'owego lub odkryć w czasie wykonania

Pytaj użytkownika tylko gdy odpowiedź materialnie wpływa na architekturę, scope, sekwencjonowanie lub ryzyko i nie może być odpowiedzialnie wywnioskowana.

**Nie** uruchamiaj testów, nie buduj aplikacji, nie badaj zachowania runtime'owego w tej fazie. Celem jest solidny plan, nie częściowe wykonanie.

### Faza 3: Ustrukturyzuj plan

#### 3.1 Tytuł i nazewnictwo pliku

- Stwórz jasny, wyszukiwalny tytuł w konwencjonalnym formacie jak `feat: Dodaj autentykację użytkowników` lub `fix: Zapobiegaj podwójnemu submitowi checkout`
- Określ typ planu: `feat`, `fix` lub `refactor`
- Zbuduj nazwę pliku według konwencji repozytorium: `docs/plans/YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.md`
  - Stwórz `docs/plans/` jeśli nie istnieje
  - Sprawdź istniejące pliki na dzisiejszą datę żeby określić następny numer sekwencyjny (zero-padded do 3 cyfr, zaczynając od 001)
  - Nazwa opisowa powinna być zwięzła (3-5 słów) i w kebab-case
  - Przykłady: `2026-01-15-001-feat-user-authentication-flow-plan.md`, `2026-02-03-002-fix-checkout-race-condition-plan.md`
  - Unikaj: brakujących numerów sekwencyjnych, niejasnych nazw jak "new-feature", nieprawidłowych znaków (dwukropki, spacje)

#### 3.2 Świadomość interesariuszy i wpływu

Dla planów **Standardowych** lub **Głębokich** krótko rozważ kogo dotyczy ta zmiana — użytkownicy końcowi, developerzy, operacje, inne zespoły — i jak to powinno kształtować plan. Dla pracy cross-cutting zanotuj dotknięte strony w sekcji Wpływ systemowy.

#### 3.3 Rozbij pracę na Implementation Units

Rozbij pracę na logiczne implementation units. Każdy unit powinien reprezentować jedną znaczącą zmianę którą implementator mógłby typowo wylądować jako atomowy commit.

Dobre unity:
- Skupione na jednym komponencie, zachowaniu lub seam integracyjnym
- Zazwyczaj dotykające małego klastra powiązanych plików
- Uporządkowane według zależności
- Wystarczająco konkretne do wykonania bez pre-pisania kodu
- Oznaczone składnią checkbox do śledzenia postępu

Unikaj:
- 2-5 minutowych micro-kroków
- Unitów obejmujących wiele niepowiązanych problemów
- Unitów tak niejasnych że implementator wciąż musi wymyślić plan

#### 3.3b Pogrupuj IU w fazy (obowiązkowe na każdej głębokości)

Autopilot wykonuje plan **fazami**: faza = jednostka `execute → review → fix`, a `/dev-docs` przenosi fazy z planu 1:1 do `docs/active/<zadanie>/` (nie wymyśla własnego podziału). Dlatego podział na fazy jest decyzją **plannera**, nie `/dev-docs`:

- Każdy IU należy do dokładnie jednej fazy. Plan Lekki ma zwykle **jedną** fazę; Standardowy 2–3; Głęboki 3–6.
- **Numeracja numeryczna od 1** (`Faza 1`, `Faza 2`, …) — autopilot, review (`review-faza-N.md`) i sekcje `## Operator checklist faza N` operują na numerach. Nie używaj liter ani nazw bez numeru.
- Nagłówek fazy w sekcji Implementation Units: `### Faza N — <nazwa>`, a pod nim jedna linia `**Zależy od:** Brak | Faza K` oraz (opcjonalnie) `**Równolegle z:** Faza M`, gdy fazy są niezależne. Informacja o równoległości jest dokumentacyjna — autopilot i tak wykonuje fazy sekwencyjnie, ale operator może tak uruchomić dwa zadania.
- Kryterium cięcia: faza kończy się w stanie, który da się **zreviewować i przetestować niezależnie** (typecheck/testy przechodzą, aplikacja działa). Typowy układ: fundament danych (migracje, typy, walidacje) → warstwa danych/akcje → strony/komponenty → polish/E2E. Nie rób fazy z jednego trywialnego IU, jeśli naturalnie należy do sąsiedniej.
- IU ze scenariuszem `[E2E]` umieszczaj w fazie, w której istnieje już wszystko, czego flow potrzebuje (strona + dane + seed) — inaczej tester nie ma czego uruchomić i scenariusz spadnie do Operatora.

#### 3.4 Zdefiniuj każdy Implementation Unit

Dla każdego unitu dołącz:
- **Cel** — co ten unit osiąga
- **Wymagania** — które wymagania lub kryteria sukcesu realizuje
- **Zależności** — co musi istnieć wcześniej
- **Pliki** — dokładne ścieżki plików do stworzenia, modyfikacji lub testowania
- **Delegate to** — subagent wykonujący ten unit (`feature-builder-ui` | `feature-builder-data` | `feature-builder-fullstack`). Reguła decyzyjna w sekcji 3.5.
- **Skills in play** — lista skilli aktywnych podczas implementacji (mirror frontmatter `skills:` wybranego subagenta). Dokumentacyjne, dla czytelności planu.
- **Podejście** — kluczowe decyzje, przepływ danych, granice komponentów lub notatki integracyjne
- **Notatka wykonawcza** — opcjonalna, tylko gdy unit korzysta z niestandardowej postawy wykonawczej jak test-first lub characterization-first
- **Wzorce do naśladowania** — istniejący kod lub konwencje do odwzorowania
- **Scenariusze testowe** — konkretne zachowania, edge cases i ścieżki awarii do pokrycia. Rozróżniaj typy: `[Unit]` dla testów kodu, `[E2E]` dla scenariuszy do weryfikacji w przeglądarce przez `/agent-browser`, `[Manual]` dla pojedynczych testów wymagających człowieka (np. weryfikacja na fizycznym urządzeniu)
- **Weryfikacja** — wyłącznie **automatyzowalne** kryteria PASS/FAIL: komenda CLI (typecheck/test/lint/grep) **lub** runner E2E niebędący scenariuszem (np. skrypt `e2e/<etap>-run-all.sh`); scenariusze E2E idą do „Scenariusze testowe" jako `[E2E]`, nie tutaj. Każdy checkbox `Weryfikacja:` musi być możliwy do domknięcia bez udziału człowieka, wyrażony jako oczekiwany wynik a nie literalny skrypt komend shellowych. Powód: `/dev-docs-review` automatycznie odznacza `Weryfikacja:` po PASS — checkbox nieautomatyzowalny pozostanie wiecznie `[ ]` i zafałszuje raport postępu. Jeśli kryterium wymaga człowieka — przenieś do `Operator checklist` lub do `Scenariusze testowe` jako `[Manual]`. Scenariusze E2E żyją w „Scenariusze testowe" jako `[E2E] \`<flow>\` — …` (jedna linia per scenariusz — patrz 3.4b); w `Weryfikacja:` marker `[E2E]` tylko dla runnera niebędącego scenariuszem — nigdy druga linia dla tego samego flow (parsery autopilota liczą linie `[E2E]` jako osobne przebiegi i dopasowują po nazwie flow)
- **Operator checklist** *(opcjonalne)* — kroki wymagające człowieka (manual test na urządzeniu, weryfikacja przez QA, akceptacja designera). Są celowo poza automatyzacją autopilota — operator zaznacza je ręcznie po wykonaniu. Pomiń sekcję jeśli IU nie ma takich kroków

Każdy feature-bearing unit powinien zawierać ścieżkę pliku testowego w `**Pliki:**`. Dla unitów modyfikujących komponenty UI lub ścieżki użytkownika — dołącz scenariusze `[E2E]` opisujące flow do przetestowania przez `/agent-browser` (otwórz URL, zrób snapshot, kliknij X, sprawdź Y, zrób screenshot).

Używaj `Notatka wykonawcza` oszczędnie. Dobre użycia:
- `Notatka wykonawcza: Zacznij od failing integration testu dla kontraktu request/response.`
- `Notatka wykonawcza: Dodaj characterization coverage przed modyfikacją tego legacy parsera.`
- `Notatka wykonawcza: Implementuj nowe zachowanie domenowe test-first.`

Nie rozwijaj unitów w literalne substepy `RED/GREEN/REFACTOR`.

#### 3.4b Zarządzany harness E2E — seedy i baza testowa

Autonomiczne E2E (autopilot) działa na **dedykowanym projekcie testowym** opisanym w `.env.e2e` (NIGDY dev/prod). Środowisko stawia i sprząta sam autopilot (dev server Vite z `--mode e2e` na bazie `.env.e2e`, `supabase db push` migracji + seedy, konto `E2E_TEST_EMAIL`); tester `feature-tester-e2e` (agent-browser) **tylko odpala** scenariusz w przeglądarce — **nie pisze flow**. Planując scenariusze `[E2E]`, przestrzegaj:

- **W webie sam flow opisuje checkbox `[E2E]`** (URL, kroki: otwórz, kliknij, sprawdź, screenshot) — agent-browser wykonuje go z opisu, NIE ma osobnego pliku flow. **Każdy scenariusz `[E2E]` w „Scenariusze testowe" ma postać `[E2E] \`<flow>\`[ (seed: e2e/seeds/<x>-seed.sql)] — <scenariusz: otwórz URL, kliknij X, sprawdź Y, screenshot> → <oczekiwany stan>`**, gdzie `<flow>` to stabilny kebab-case identyfikator scenariusza — to JEDYNA nośna linia scenariusza (db-sync czyta z niej seed, tester i scribe dopasowują przebiegi po nazwie flow); w `Weryfikacja:` nie dubluj jej drugą linią `[E2E]` dla tego samego flow (każda linia `[E2E]` = osobny przebieg w licznikach), a `Weryfikacja: [E2E]` zostaw wyłącznie dla runnerów niebędących scenariuszem (np. `run-all.sh`). Deliverable BUILDERA jest **seed** — dwie gałęzie: (1) scenariusz potrzebuje danych, których nie ma w stanie bazowym konta `E2E_TEST_EMAIL` ani w żadnym istniejącym seedzie → `Stwórz (e2e seed): e2e/seeds/<flow>-seed.sql` w `Pliki:`; (2) dane są w istniejącym `e2e/seeds/<x>-seed.sql` → nie twórz nowego, ale wpisz jego nazwę w linii scenariusza. Przypisz IU do buildera (`feature-builder-*`). Autorstwo seeda NIGDY nie może wisieć pod checkboxem testera ani w bloku testera, bo wtedy nikt go nie napisze i E2E cicho spadnie do Operatora (udokumentowana regresja w szablonie mobile: powstał seed bez flow → E2E nie przebiegło).
- **Seed musi być idempotentny** (DELETE/upsert, bezpieczny do re-runu) i referować konto testowe przez `(select id from auth.users where email='<E2E_TEST_EMAIL>')` — **nigdy przez stałe ID**. Wzór: istniejący seed w `e2e/seeds/`. Flow loguje się kontem `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` (email+hasło, NIE OAuth — popup providera jest niedostępny headless).
- **E2E celuje w projekt z `.env.e2e`** — nigdy nie wstrzykuj danych testowych do dev/prod ani przez Supabase MCP. Smoke RLS (np. odmowa nie-uczestnikowi) wykonuj SQL-em na bazie e2e (`psql "$SUPABASE_E2E_DB_URL"`).
- **Realtime / multi-client realistycznie:** single-client (render, wysłanie, optimistic+echo dedup) jest autonomicznie testowalny i należy do `[E2E]`. Prawdziwy two-client „na żywo" (równoczesne karty/urządzenia) → `Operator checklist` `[Manual]`, bo harness single-client tego nie dowiedzie.
- **Projekt bez `.env.e2e`** (brak opt-in do E2E): scenariusz `[E2E]` przenieś do `Operator checklist` jako `[Manual]` — seed nie jest wtedy wymagany. Setup harnessu: `.claude/templates/e2e-env/README.md`.

#### 3.5 Wybór subagenta dla IU

Każdy Implementation Unit MUSI mieć zadeklarowany `Delegate to:` — nazwa subagenta z `.claude/agents/`, który go wykona. Reguła decyzyjna oparta na ścieżkach z pola `Pliki:`:

| Ścieżki w `Pliki:` | Subagent | Skille (mirror dla `Skills in play:`) |
|---|---|---|
| Tylko `*.tsx` w `src/components/`, `src/features/<x>/components/`, `src/pages/`, lub `*.css` | `feature-builder-ui` | tailwind-react-guidelines, ux-ui-guidelines, figma:figma-use, figma-design-to-code |
| Tylko `*.ts` w `src/lib/`, `src/hooks/use<X>Data.ts`, `supabase/migrations/`, `supabase/functions/` | `feature-builder-data` | supabase-dev-guidelines, security, sentry-integration |
| Mix UI i danych w jednym atomowym IU | `feature-builder-fullstack` | tailwind-react-guidelines, ux-ui-guidelines, supabase-dev-guidelines, security, sentry-integration, figma:figma-use, figma-design-to-code |

**Reguła praktyczna:** jeśli da się rozsądnie podzielić na dwa osobne IU (jeden UI, drugi data) — podziel. `feature-builder-fullstack` używaj **tylko** gdy podział byłby sztuczny (np. formularz logowania, gdzie UI bez auth call lub auth call bez formularza są bezużyteczne).

**Figma w mirrorze:** `feature-builder-ui` i `feature-builder-fullstack` zawsze mają figma skille w `Skills in play:` (mirror frontmatera tych agentów). Te skille są aktywne tylko gdy plan ma niepuste `figma_spec`/`figma_screens` w frontmaterze — wtedy `dev-docs-execute` wstrzykuje subagentowi "Mandatory designerski kontekst". Bez tej sekcji w prompcie buildery ignorują skille figma. `feature-builder-data` nie ma figma skilli — warstwa danych nie dotyka designu.

Pole `Skills in play:` jest dokumentacyjnym mirror frontmatter `skills:` wybranego subagenta — pozwala czytelnikowi planu zrozumieć kontekst implementacji bez wchodzenia do pliku subagenta.

**Bramka spójności z 1.6:** jeśli krok A sklasyfikował feature jako pure-data, a którykolwiek IU dostaje `Delegate to: feature-builder-ui` lub `feature-builder-fullstack` → klasyfikacja była błędna. Wróć do 1.6 krok B i wykonaj B–C (oraz D–F, gdy użytkownik ma mockupy) PRZED dalszym planowaniem; zaktualizuj frontmatter `design_md`/`figma_spec`/`figma_screens`. Builder UI bez DESIGN.md/Figmy halucynuje pomiary — to dokładnie regresja, której 1.6 ma zapobiegać.

#### 3.6 Trzymaj niewiadome planistyczne i implementacyjne oddzielnie

Jeśli coś jest ważne ale jeszcze niepoznawalne, zapisz to explicite pod odroczonymi notatkami implementacyjnymi zamiast udawać że rozwiązujesz to w planie.

Przykłady:
- Dokładne nazwy metod lub helperów
- Finalne szczegóły SQL lub zapytań po dotknięciu prawdziwego kodu
- Zachowanie runtime'owe zależne od zobaczenia faktycznych test failures
- Refaktory które mogą stać się niepotrzebne po rozpoczęciu implementacji

#### 3.7 Wymagania wstępne operatora (co musi zrobić człowiek, zanim ruszy autopilot)

Przejdź po wszystkich IU i wypisz **wyłącznie** rzeczy, których Claude/autopilot nie zrobi sam, a bez których plan utknie (run zatrzyma się na bramce albo builder zaimplementuje „na ślepo"). To jest osobna kategoria od `Operator checklist` w IU (tamto = weryfikacja **po** implementacji; to = przygotowanie **przed**). Źródła do przeskanowania:

| Kategoria | Typowe pozycje | Skąd wiesz |
|---|---|---|
| Konta i konsole zewnętrzne | OAuth (Google Cloud), Sentry DSN, Stripe, klucze map, konta w zewnętrznych API | IU z `supabase/functions/`, auth, integracje; `Skills in play` z `sentry-integration` |
| Sekrety i zmienne środowiskowe | nowe klucze w `.env.local` / `.env.e2e` / `supabase secrets`, `VITE_*` | `Pliki:` tykające `.env.example`, Edge Functions czytające `Deno.env` |
| Środowisko E2E | plan ma ≥1 `[E2E]` → musi istnieć `.env.e2e` (sprawdź `ls .env.e2e`); brak = pozycja „setup wg `.claude/templates/e2e-env/README.md` (~30 min)" **albo** świadomy opt-out (scenariusze `[E2E]` → `[Manual]`). Gdy `.env.e2e` istnieje — NIE wpisuj nic: dev server Vite, migracje i seedy na projekt e2e robi sam autopilot (env-up, db-sync) | 3.4b; stan repo |
| Assety graficzne / treści | favicon, ikony, ilustracje empty state, wideo, teksty prawne, tłumaczenia od klienta | IU w `public/`, `src/assets/`, legal |
| Dane na projekcie głównym | dane wejściowe/backfill, których builder potrzebuje **do implementacji** (np. istniejące rekordy do migracji danych) — nie do rolloutu ani do testów ręcznych | IU z migracjami / czytające istniejące dane |
| Dostępy potrzebne do implementacji | dashboard Supabase/Sentry, konto w zewnętrznym API | IU integracyjne |

**Gdy operator checklist już istnieje** (plik znaleziony w 0.2 po frontmatterze — typowo z `/dev-prep`), Twoim zadaniem jest go **uzupełnić, nie odtworzyć**. Przejdź po nim i przygotuj wyłącznie **deltę**:

- **Pozycje odhaczone `[x]`** — nie ruszasz. Są zrobione; powtórzenie każe operatorowi robić to samo dwa razy.
- **Pozycje nieodhaczone, które już tam są** — dopisujesz do nich to, czego `/dev-prep` nie mógł wiedzieć: **numer blokowanego IU/fazy** (`— blokuje Fazę 2 (IU-3)`). Treści nie przepisujesz.
- **Pozycje, których tam nie ma**, a wynikają z konkretnych IU (nowy klucz w `.env.example` tykanym przez IU, sekret Edge Function, środowisko E2E) — dopisujesz jako nowe.

Dostępu do Figmy **nie wpisuj** — rozstrzyga się w 1.6 (fetch się udał albo zapadła decyzja „projektujemy z głowy"); pozycja dopisana po fakcie niczego już nie odblokuje.

Gdy dokumentu nie ma (wejście wprost do `/dev-plan`, np. bugfix), zbuduj listę od zera wg tabeli powyżej — 5.2b utworzy plik.

Fizyczne urządzenie do scenariuszy `[Manual]` (responsywność na realnym urządzeniu, push, dotyk) → `Operator checklist` / smoke po implementacji, **nie tutaj** — brak urządzenia niczego nie blokuje przed startem.

Dla każdej pozycji zapisz: **co** (konkretna czynność), **po co / co blokuje** (numer IU lub fazy, albo „bramka setupu E2E autopilota"), **jak** (kroki na tyle dokładne, żeby operator nie musiał pytać: gdzie kliknąć, jaką zmienną ustawić, jaką komendą sprawdzić), **dowód wykonania** (np. „`grep GOOGLE_CLIENT_ID .env.local` zwraca wartość"). Nie wpisuj rzeczy, które autopilot robi sam (typecheck, testy, dev server Vite, migracje i seedy na projekt e2e, `git`).

**Każda pozycja musi być wykonalna PRZED fazą, którą blokuje.** Czynności po zakończeniu zadania (`supabase db push` na dev/prod po merge, rollout, monitoring, sprzątanie danych testowych) NIE trafiają tutaj — wpisz je do `Operator checklist` IU, który je wywołuje (stamtąd `/dev-docs` przenosi je do `## Operator checklist faza N`, a `dev-docs-complete` do smoke'u operatora). Decyzje produktowe, które wciąż wymagają wyboru użytkownika, też tu nie należą — wg 0.5 to nierozwiązany bloker planowania: albo zapada jawnie jako założenie w „Kluczowe decyzje techniczne", albo planowanie się zatrzymuje.

Jeśli lista jest pusta — zanotuj to (`operator_prep: null` w frontmatter, patrz 4.2) i nie twórz pliku. Jeśli ma ≥1 pozycję — plik powstaje w 5.2b.

### Faza 4: Napisz plan

Używaj jednej filozofii planowania na wszystkich głębokościach. Zmieniaj ilość szczegółów, nie granicę między planowaniem a wykonaniem.

#### 4.1 Guidance głębokości planu

**Lekka**
- Plan powinien być kompaktowy
- Zazwyczaj 2-4 implementation units w **jednej** fazie
- Pomiń opcjonalne sekcje które dodają mało wartości

**Standardowa**
- Użyj pełnego core template
- Zazwyczaj 3-6 implementation units w 2-3 fazach
- Dołącz ryzyka, odroczone pytania i wpływ systemowy gdy relevantne

**Głęboka**
- Użyj pełnego core template plus opcjonalne sekcje analizy
- Zazwyczaj 4-8 implementation units w 3-6 fazach
- Dołącz rozważane alternatywy, wpływ na dokumentację i głębsze traktowanie ryzyk gdy uzasadnione

Na każdej głębokości fazy są obowiązkowe (3.3b) — różni się tylko ich liczba.

#### 4.1b Opcjonalne rozszerzenia Deep planu

Dla wystarczająco dużej, ryzykownej lub cross-cutting pracy, dodaj sekcje które genuinely pomagają:
- **Rozważane alternatywy**
- **Metryki sukcesu**
- **Zależności techniczne** (biblioteki, wersje, kolejność merge'ów — wymagania wobec *człowieka* idą do „Wymagania wstępne operatora", nie tutaj)
- **Analiza ryzyk i mitygacja**
- **Plan dokumentacji**
- **Notatki operacyjne / rolloutowe**
- **Przyszłe rozważania** tylko gdy materialnie wpływają na obecny design

Nie dodawaj tych sekcji jako boilerplate. Dołączaj je tylko gdy poprawiają jakość wykonania lub alignment interesariuszy.

#### 4.2 Core Plan Template

Pomiń wyraźnie niepasujące opcjonalne sekcje, szczególnie dla planów Lekkich.

```markdown
---
title: [Tytuł planu]
type: [feat|fix|refactor]
status: active
date: YYYY-MM-DD
origin: docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md  # dołącz gdy planujesz z dokumentu źródłowego (0.2); dla zbiorczego: ścieżka#sekcja
design_md: ./docs/DESIGN.md          # null jeśli pure-data feature lub brak DESIGN.md (patrz 1.6)
figma_spec: ./docs/plans/<feature-slug>-figma/SPEC.md   # null jeśli brak mockupów Figmy
figma_screens:                       # {} jeśli brak mockupów; mapa name → ścieżka PNG
  home: ./docs/plans/<feature-slug>-figma/home.png
  settings: ./docs/plans/<feature-slug>-figma/settings.png
operator_prep: ./docs/operator/<nazwa checklisty>.md   # faktyczna ścieżka z 5.2b; null gdy lista z 3.7 jest pusta
---

# [Tytuł planu]

## Przegląd

[Co się zmienia i dlaczego]

## Ujęcie problemu

[Podsumuj problem użytkownika/biznesowy i kontekst. Odwołaj się do dokumentu źródłowego gdy jest.]

## Śledzenie wymagań

- R1. [Wymaganie lub kryterium sukcesu które plan musi spełnić]
- R2. [Wymaganie lub kryterium sukcesu które plan musi spełnić]

## Granice scope'u

- [Explicite non-goal lub wykluczenie]

## Kontekst i research

### Relevantny kod i wzorce

- [Istniejący plik, klasa, komponent lub wzorzec do naśladowania]

### Wiedza instytucjonalna

- [Relevantny insight z `docs/solutions/`]

### Referencje zewnętrzne

- [Relevantne zewnętrzne docs lub źródło best-practice, jeśli użyte]

## Kluczowe decyzje techniczne

- [Decyzja]: [Uzasadnienie]

## Otwarte pytania

### Rozwiązane podczas planowania

- [Pytanie]: [Rozwiązanie]

### Odroczone do implementacji

- [Pytanie lub niewiadoma]: [Dlaczego jest świadomie odroczone]

## Wymagania wstępne operatora

[Z 3.7. Jeśli lista pusta: „Brak — autopilot może startować od razu." Jeśli niepusta: jedno zdanie + link do checklisty (ścieżka z `operator_prep`, ustalona w 5.2b) i skrót pozycji jako lista `- [ ]` z numerem blokowanej fazy/IU, np. „- [ ] Google OAuth client ID w `.env.local` — blokuje Fazę 2 (IU-3)".]

## Implementation Units

[Każdy IU pod nagłówkiem swojej fazy (3.3b). Numeracja IU ciągła przez cały plan (IU-1, IU-2, …), numeracja faz od 1.]

### Faza 1 — [Nazwa fazy]

**Zależy od:** Brak
**Równolegle z:** — *(opcjonalne)*

- [ ] **IU-1: [Nazwa]**

**Cel:** [Co ten unit osiąga]

**Wymagania:** [R1, R2]

**Zależności:** [Brak / IU-1 / zewnętrzny prerequisite]

**Pliki:**
- Stwórz: `ścieżka/do/nowego_pliku`
- Modyfikuj: `ścieżka/do/istniejącego_pliku`
- Test (unit): `ścieżka/do/pliku_testowego`
- Stwórz (e2e seed): `e2e/seeds/<flow>-seed.sql` *(idempotentny, konto przez `E2E_TEST_EMAIL`; pomiń gdy flow nie potrzebuje danych spoza stanu bazowego; istniejący seed wskaż w linii scenariusza `[E2E]` jako `(seed: e2e/seeds/<x>-seed.sql)` — patrz 3.4b)*

**Delegate to:** feature-builder-ui | feature-builder-data | feature-builder-fullstack

**Skills in play:** [lista skilli — mirror frontmatter `skills:` wybranego subagenta]

**Podejście:**
- [Kluczowa decyzja designu lub sekwencjonowania]

**Notatka wykonawcza:** [Opcjonalny sygnał postawy test-first, characterization-first lub innej]

**Wzorce do naśladowania:**
- [Istniejący plik, klasa lub wzorzec]

**Scenariusze testowe:**
- [Unit] [Konkretny scenariusz z oczekiwanym zachowaniem]
- [Unit] [Edge case lub ścieżka awarii]
- [E2E] `<flow>`[ (seed: e2e/seeds/<x>-seed.sql)] — [scenariusz: otwórz URL, kliknij X, sprawdź Y, screenshot] → [oczekiwany stan] *(jedna linia per scenariusz; `<flow>` = kebab-case identyfikator; seed z `Pliki:` tego IU lub istniejący)*
- [Manual] [Krok wymagający człowieka, np. weryfikacja na fizycznym urządzeniu] *(opcjonalne — używaj gdy automatyzacja jest niemożliwa)*

**Weryfikacja:** *(wyłącznie automatyzowalne — CLI lub runner E2E; rzeczy ręczne idą do Operator checklist niżej)*
- [Komenda CLI z oczekiwanym wynikiem, np. "bun run typecheck przechodzi bez błędów"]
- [E2E] `e2e/<etap>-run-all.sh` — [oczekiwany stan] *(TYLKO dla runnera niebędącego scenariuszem z listy wyżej — scenariusze `[E2E]` nie mają drugiej linii w Weryfikacji)*

**Operator checklist:** *(opcjonalne — kroki wymagające człowieka, NIE odznaczane przez autopilot)*
- [ ] [Krok wymagający operatora, np. "QA weryfikuje animację na realnym urządzeniu iOS"]

### Faza 2 — [Nazwa fazy]

**Zależy od:** Faza 1

- [ ] **IU-2: [Nazwa]**

[… ta sama struktura pól co IU-1 …]

## Wpływ systemowy

- **Graf interakcji:** [Jakie callbacki, middleware, observery lub entry pointy mogą być dotknięte]
- **Propagacja błędów:** [Jak awarie powinny podróżować między warstwami]
- **Ryzyka cyklu życia stanu:** [Częściowy zapis, cache, duplikaty lub problemy cleanup]
- **Parytet surface API:** [Inne interfejsy które mogą wymagać tej samej zmiany]
- **Pokrycie integracyjne:** [Scenariusze cross-layer których unit testy same nie udowodnią]

## Ryzyka i zależności

- [Materialny risk, zależność lub problem sekwencjonowania]

## Dokumentacja / Notatki operacyjne

- [Docs, rollout, monitoring lub wpływ na support gdy relevantne]

## Źródła i referencje

- **Dokument źródłowy:** [docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md](ścieżka)
- Powiązany kod: [ścieżka lub symbol]
- Powiązane PR/issues: #[numer]
- Zewnętrzne docs: [url]
```

Dla większych planów `Głębokich` rozszerzaj core template tylko gdy to przydatne sekcjami takimi jak:

```markdown
## Rozważane alternatywy

- [Podejście]: [Dlaczego odrzucone lub niewybrane]

## Metryki sukcesu

- [Jak poznamy że to rozwiązało zamierzony problem]

## Zależności techniczne

- [Biblioteka, wersja, kolejność merge'ów — NIE czynności człowieka (te są w „Wymagania wstępne operatora")]

## Analiza ryzyk i mitygacja

- [Ryzyko]: [Mitygacja]

## Plan dokumentacji

- [Docs lub runbooki do aktualizacji]

## Notatki operacyjne / rolloutowe

- [Monitoring, migracja, feature flag lub rozważania rolloutowe]
```

#### 4.3 Zasady planowania

- Preferuj ścieżki plus referencje do klas/komponentów/wzorców nad kruche numery linii
- Implementation units powinny być checkable składnią `- [ ]` do śledzenia postępu
- Nie dołączaj fenced bloków kodu implementacji chyba że plan sam dotyczy kształtu kodu jako artefaktu designu
- Nie dołączaj komend git, commit messages ani dokładnych receptur komend testowych
- Nie rozwijaj implementation units w micro-step instrukcje `RED/GREEN/REFACTOR`
- Nie udawaj że pytanie wykonawcze jest rozstrzygnięte tylko żeby plan wyglądał na kompletny
- Dołączaj diagramy mermaid gdy wyjaśniają relacje lub flow które sama proza uczyniłaby trudnymi do prześledzenia — ERD dla zmian modelu danych, diagramy sekwencji dla interakcji multi-service, diagramy stanu dla przejść cyklu życia, flowcharty dla złożonej logiki rozgałęzień

### Faza 5: Finalny review, zapis pliku i handoff

#### 5.1 Review przed zapisem

Przed finalizacją sprawdź:
- Plan nie wymyśla zachowań produktu które powinny być zdefiniowane w `/dev-brainstorm`
- Jeśli nie było dokumentu źródłowego, bounded planning bootstrap ustalił wystarczająco dużo jasności produktowej żeby planować odpowiedzialnie
- Każda główna decyzja jest ugruntowana w dokumencie źródłowym lub researchu
- Każdy implementation unit jest konkretny, uporządkowany według zależności i gotowy do implementacji
- Każdy implementation unit ma wypełnione `Delegate to:` zgodnie z regułą decyzyjną z sekcji 3.5
- Pole `Skills in play:` w każdym IU jest spójne z frontmatter `skills:` wybranego subagenta
- Frontmatter planu ma wypełnione pola `design_md`, `figma_spec`, `figma_screens` (zgodnie z 1.6) — jako konkretne ścieżki LUB explicite `null`/`{}`. Nigdy nie pomijaj tych pól.
- Jeśli `figma_spec` ≠ null — plik istnieje na dysku (`Read` go zwraca treść), a każdy ekran z `figma_screens` ma fizycznie zapisany PNG
- Każdy IU delegowany do `feature-builder-ui` lub `feature-builder-fullstack` ma w `Skills in play:` figma skille (mirror per sekcja 3.5), niezależnie od tego czy ten konkretny IU korzysta z mockupu — bo skille są w frontmaterze agenta
- Jeśli plan ma ≥1 IU z `Delegate to:` ui|fullstack, kroki B–C z 1.6 zostały wykonane (użytkownik był zapytany o Figmę, linki były w źródle albo przyszły z dokumentu `/dev-prep`) — `figma_spec: null` dopuszczalne tylko jako świadoma odpowiedź „Nie — projektujemy z głowy", nigdy jako skutek pominięcia 1.6 przy klasyfikacji pure-data
- Jeśli postawa test-first lub characterization-first była explicite lub silnie implikowana, relevantne unity niosą ją dalej z lekką `Notatką wykonawczą`
- Scenariusze testowe są konkretne bez stawania się kodem testowym
- Każdy checkbox `Weryfikacja:` jest automatyzowalny (CLI lub runner E2E). Kroki wymagające człowieka są w `Operator checklist` lub jako `[Manual]` w `Scenariusze testowe` — nigdy w `Weryfikacja:`
- Każdy `[E2E]` w „Scenariusze testowe" ma postać `[E2E] \`<flow>\`[ (seed: …)] — <scenariusz> → <stan>`, wskazany seed występuje w `Pliki:` tego IU jako `Stwórz (e2e seed):` albo istnieje w `e2e/seeds/`, a w `Weryfikacja:` nie ma drugiej linii `[E2E]` wskazującej ten sam flow (dozwolony wyłącznie runner `.sh`)
- Każdy IU jest pod nagłówkiem `### Faza N — <nazwa>` z numeracją od 1 bez luk, każda faza ma `**Zależy od:**`, a żadna faza nie jest pusta (3.3b)
- Sekcja „Wymagania wstępne operatora" istnieje i jest spójna z frontmatterem `operator_prep` (ścieżka gdy ≥1 pozycja, `null` gdy pusta). Jeśli plan ma ≥1 `[E2E]`, a `.env.e2e` nie istnieje — lista NIE może być pusta (pozycja setupu wg `.claude/templates/e2e-env/README.md` albo opt-out do `[Manual]`)
- Odroczone elementy są explicite i nie ukryte jako fałszywa pewność

Jeśli plan pochodzi z requirements doc, przeczytaj ponownie ten dokument i zweryfikuj:
- Wybrane podejście wciąż pasuje do intencji produktu
- Granice scope'u i kryteria sukcesu są zachowane
- Blokujące pytania zostały rozwiązane, explicite założone lub odesłane do `/dev-brainstorm`
- Każda sekcja dokumentu źródłowego jest zaadresowana w planie — przeskanuj każdą sekcję żeby potwierdzić że nic nie zostało cicho pominięte

#### 5.2 Zapisz plik planu

**WYMAGANE: Zapisz plik planu na dysk przed prezentowaniem jakichkolwiek opcji.**

Użyj `mkdir -p docs/plans/` przed zapisem. Następnie użyj narzędzia Write żeby zapisać kompletny plan do:

```text
docs/plans/YYYY-MM-DD-NNN-<type>-<descriptive-name>-plan.md
```

Potwierdź:

```text
Plan zapisany do docs/plans/[nazwa-pliku]
```

#### 5.2b Operator checklist — uzupełnij albo utwórz (gdy delta z 3.7 jest niepusta)

Plik jest zawsze jeden. Gdy 0.2 go znalazło — używasz **jego ścieżki, jaka jest**, bez zmiany nazwy (`/dev-prep` mógł zdziedziczyć konwencję serii, np. `docs/operator/e3-operator-checklist.md`). Gdy go nie ma — tworzysz `docs/operator/<feature-slug>-przygotowanie.md` (`<feature-slug>` z 1.6, ten sam co w `docs/plans/<feature-slug>-figma/`); jeśli w `docs/operator/` widać serię checklist o innej konwencji nazw, dopasuj się do niej tak samo jak `/dev-prep` (jego krok 0.3). Faktyczną ścieżkę wpisz do frontmattera planu jako `operator_prep:` — to ona jest referencją dla `/dev-docs`, nie żaden wzorzec nazwy.

**Gdy plik istnieje** (utworzony przez `/dev-prep`, znaleziony w 0.2) — **edytuj go w miejscu narzędziem `Edit`, nigdy `Write`**:

- Dopisz numery blokowanych faz przy pozycjach, które już tam są.
- Dodaj nowe pozycje z delty 3.7 do właściwych sekcji („Konta, konsole, sekrety" / „Assety i treści" / nowa sekcja „Środowisko E2E", gdy dotyczy).
- **Nie kasuj i nie przepisuj `[x]`** ani wpisanych przy nich wartości i dat — to dziennik ustaleń operatora.
- **Nie duplikuj sekcji** ani nagłówka. Nie zmieniaj układu sekcji zastanego w pliku.
- Dopisz jedną linię pod nagłówkiem: `Uzupełnione przez /dev-plan YYYY-MM-DD — pozycje z Implementation Units oznaczone numerem blokowanej fazy.`

Potwierdź: `Operator checklist uzupełniony: <ścieżka pliku> (+N pozycji z IU, M blokuje start)`

**Gdy pliku nie ma** (wejście wprost do `/dev-plan`) — `mkdir -p docs/operator/` i zapisz nowy wg układu poniżej:

```markdown
# Przygotowanie dla operatora — <Tytuł planu>

Plan: `docs/plans/YYYY-MM-DD-NNN-<type>-<name>-plan.md` · Utworzono: YYYY-MM-DD
Status: **do zrobienia przed autopilotem** — odhaczaj `[ ]` → `[x]`. `/dev-docs` sprawdzi tę listę przed handoffem.

To lista rzeczy, których autopilot nie zrobi sam. Bez nich run zatrzyma się na bramce
(środowisko E2E) albo builder zaimplementuje funkcję bez realnych danych/kluczy.
Pozycje oznaczone **[blokuje start]** muszą być gotowe przed pierwszą fazą; pozostałe — przed fazą podaną w nawiasie.

## 1. <Kategoria z tabeli 3.7, np. Konta i konsole zewnętrzne>

- [ ] **<Co zrobić>** — **[blokuje start]** / (przed Fazą N, IU-K)
  - Po co: <jedno zdanie — co się stanie bez tego>
  - Jak: <kroki: gdzie wejść, co kliknąć, jaką wartość skopiować, do jakiej zmiennej>
  - Dowód: <komenda lub obserwacja, np. `grep GOOGLE_CLIENT_ID .env.local` zwraca wartość>

## 2. Środowisko E2E   ← sekcja obowiązkowa TYLKO gdy plan ma ≥1 `[E2E]` a `ls .env.e2e` zwraca brak (spójnie z 3.7/5.1); gdy `.env.e2e` istnieje — pomiń całą sekcję (dev server Vite, migracje i seedy weryfikuje/robi sam autopilot w env-up i db-sync)

- [ ] **Postaw środowisko E2E wg `.claude/templates/e2e-env/README.md` (~30 min, one-time)** — **[blokuje start]** (bramka setupu autopilota)
  - Po co: plan ma N scenariuszy `[E2E]`; bez `.env.e2e` autopilot zatrzyma run przed fazą 1.
  - Jak: README prowadzi krok po kroku (dedykowany projekt Supabase e2e — NIGDY ref dev/prod, `.env.e2e` z `.env.e2e.example`, wpis do `.gitignore`, konto testowe, tryb `--mode e2e` Vite). Świadomy opt-out: zamień `[E2E]` → `[Manual]` w planie i przenieś do Operator checklist.
  - Dowód: `test -f .env.e2e && git check-ignore -q .env.e2e && echo OK` → OK; `<pm> run dev -- --mode e2e --port 5173` startuje, a localhost:5173 loguje się kontem `E2E_TEST_EMAIL`

---
Po odhaczeniu wszystkiego: `/dev-docs` → autopilot.
```

Reguły treści: każdy punkt ma wszystkie trzy pola (Po co / Jak / Dowód); sekrety opisuj nazwą zmiennej, nigdy wartością; nie powtarzaj tu `Operator checklist` z IU (to weryfikacja po implementacji — trafi do smoke'u operatora generowanego przy `dev-docs-complete`).

Potwierdź:

```text
Przygotowanie dla operatora zapisane do <ścieżka checklisty> (N pozycji, M blokuje start)
```

**Tryb pipeline:** Jeśli wywołany z automatycznego workflow lub kontekstu `disable-model-invocation`, pomiń interaktywne pytania. Podejmij potrzebne wybory automatycznie i kontynuuj do zapisu planu.

#### 5.3 Opcje po wygenerowaniu

Po zapisie plików prezentuj opcje używając narzędzia pytań platformy gdy dostępne. W przeciwnym razie prezentuj numerowane opcje w chacie i czekaj na odpowiedź.

**Pytanie:** "Plan gotowy w `docs/plans/YYYY-MM-DD-NNN-<type>-<name>-plan.md`[ + przygotowanie dla operatora w `<ścieżka checklisty>` (N pozycji, M blokuje start)]. Co chciałbyś zrobić dalej?"

**Opcje:**
1. **Uruchom `/dev-docs`** (Rekomendowane) — potnij plan na zadania dla autopilota (`docs/active/`) i utwórz branch
2. **Otwórz plan w edytorze** — przejrzyj plik planu przed dalszymi krokami
3. **Gotowe na teraz** — wróć później (np. najpierw odhacz przygotowanie dla operatora)

Na podstawie wyboru:
- **`/dev-docs`** -> Uruchom `/dev-docs` ze ścieżką do planu
- **Otwórz plan w edytorze** -> Otwórz `docs/plans/<nazwa_pliku>.md` używając mechanizmu otwierania plików platformy (np. `open` na macOS), potem wróć do opcji
- **Inne** -> Przyjmij wolny tekst do rewizji i wróć do opcji

**Nie oferuj `/dev-docs-execute` ani autopilota bezpośrednio z planu.** Wykonanie zawsze idzie przez `/dev-docs` (branch + `docs/active/` + stan zadania) — bez tego autopilot nie ma czego wznawiać, a review nie ma gdzie zapisywać findingów.

NIGDY NIE KODUJ! Badaj, decyduj i zapisz plan.

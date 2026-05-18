---
name: dev-plan
description: "Planowanie techniczne implementacji z Implementation Units."
argument-hint: "[opcjonalnie: ścieżka do requirements doc lub opis feature'a]"
---

# Stwórz plan techniczny

**Uwaga: Aktualny rok to 2026.** Używaj tego przy datowaniu planów i wyszukiwaniu dokumentacji.

`/dev-brainstorm` definiuje **CO** budować. `/dev-plan` definiuje **JAK** to zbudować. `/dev-docs-execute` wykonuje plan.

Ten workflow produkuje trwały plan implementacji. **Nie** implementuje kodu, nie uruchamia testów, nie uczy się z wyników runtime'u. Jeśli odpowiedź zależy od zmiany kodu i zobaczenia co się stanie, to należy do `/dev-docs-execute`, nie tutaj.

## Metoda interakcji

Używaj narzędzia pytań platformy gdy dostępne. Przy zadawaniu pytań użytkownikowi preferuj blokujące narzędzie pytań platformy (`AskUserQuestion` w Claude Code). W przeciwnym razie prezentuj numerowane opcje w chacie i czekaj na odpowiedź.

Zadawaj jedno pytanie na raz. Preferuj zwięzły single-select gdy istnieją naturalne opcje.

## Opis feature'a

<feature_description> #$ARGUMENTS </feature_description>

**Jeśli opis powyżej jest pusty:** przeszukaj `docs/brainstorms/` w poszukiwaniu plików `*-requirements.md`. Jeśli znajdziesz relevantny dokument, użyj go jako inputu. Jeśli nie znajdziesz, zapytaj: "Co chciałbyś zaplanować? Opisz feature, bug fix lub usprawnienie."

Nie kontynuuj dopóki nie masz jasnego inputu do planowania.

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

Przed zadawaniem pytań planistycznych przeszukaj `docs/brainstorms/` w poszukiwaniu plików pasujących do `*-requirements.md`.

**Kryteria trafności:** Requirements doc jest trafny jeśli:
- Temat semantycznie pasuje do opisu feature'a
- Został stworzony w ciągu ostatnich 30 dni (użyj rozsądku żeby nadpisać gdy dokument jest wyraźnie wciąż trafny lub wyraźnie nieaktualny)
- Wydaje się pokrywać ten sam problem użytkownika lub scope

Jeśli wiele dokumentów źródłowych pasuje, zapytaj którego użyć używając narzędzia pytań platformy gdy dostępne. W przeciwnym razie prezentuj numerowane opcje w chacie i czekaj na odpowiedź.

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

Jeśli nie istnieje relevantny requirements doc:
- Oceń czy request jest już wystarczająco jasny do bezpośredniego planowania technicznego
- Jeśli niejednoznaczność dotyczy głównie ujęcia produktu, zachowań użytkownika lub definicji scope'u, zarekomenduj najpierw `/dev-brainstorm`
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

**Krok A — Klasyfikacja feature'a.** Zadaj użytkownikowi pytanie przez `AskUserQuestion`:

> "Czy ten feature dotyka warstwy UI (komponenty, ekrany, layouty)?"

Opcje: `Tak — dotyka UI` / `Nie — pure-data (backend/migracje/Edge Functions)`.

Jeśli **Nie** → pomiń resztę sekcji 1.6, w frontmatter planu (4.2) wstaw `design_md: null`, `figma_spec: null`, `figma_screens: []`.

Jeśli **Tak** → kontynuuj krok B.

**Krok B — Projektowy DESIGN.md.** Sprawdź czy istnieje `docs/DESIGN.md` (Read tool). 

- Jeśli istnieje → zapisz ścieżkę do późniejszego frontmatera planu jako `design_md: ./docs/DESIGN.md` i ogłoś: "Używam `docs/DESIGN.md` jako źródła prawdy o tokenach designu projektu."
- Jeśli **nie istnieje** → zadaj `AskUserQuestion`:

  > "Brak `docs/DESIGN.md` (projekt-wide design system w formacie Google Labs design.md — YAML tokeny + markdown prose). Co robimy?"

  Opcje:
  1. `Stwórz teraz — zatrzymaj planowanie` (rekomendowane) — wyjdź z dev-plan, poinstruuj usera żeby stworzył `docs/DESIGN.md` (spec: https://github.com/google-labs-code/design.md). Plan można wznowić później.
  2. `Pomiń dla tej iteracji` — kontynuuj bez `DESIGN.md`, zapisz `design_md: null` w frontmatter, dodaj do "Otwarte pytania → Odroczone do implementacji" wpis: "Brak `docs/DESIGN.md` — buildery UI bazują tylko na ux-ui-guidelines i SPEC per-feature. Utwórz przed kolejnym UI feature'em."

**Krok C — Mockupy Figmy dla tej iteracji.** Zadaj `AskUserQuestion`:

> "Czy masz w Figmie mockupy ekranów dla tej iteracji?"

Opcje: `Tak — podam linki` / `Nie — projektujemy z głowy w oparciu o DESIGN.md`.

Jeśli **Nie** → wstaw `figma_spec: null`, `figma_screens: []` w frontmatter, kontynuuj do Fazy 2.

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

Po zebraniu danych ze wszystkich ekranów stwórz **jeden** plik `docs/plans/<feature-slug>-figma/SPEC.md` z układem:

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
1. `Re-fetch i nadpisz` — pociągnij świeże dane z Figmy, nadpisz SPEC i PNG.
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
- **Weryfikacja** — wyłącznie **automatyzowalne** kryteria PASS/FAIL: komenda CLI (typecheck/test/lint/grep) **lub** scenariusz E2E weryfikowalny przez `/agent-browser`. Każdy checkbox `Weryfikacja:` musi być możliwy do domknięcia bez udziału człowieka, wyrażony jako oczekiwany wynik a nie literalny skrypt komend shellowych. Powód: `/dev-docs-review` automatycznie odznacza `Weryfikacja:` po PASS — checkbox nieautomatyzowalny pozostanie wiecznie `[ ]` i zafałszuje raport postępu. Jeśli kryterium wymaga człowieka — przenieś do `Operator checklist` lub do `Scenariusze testowe` jako `[Manual]`
- **Operator checklist** *(opcjonalne)* — kroki wymagające człowieka (manual test na urządzeniu, weryfikacja przez QA, akceptacja designera). Są celowo poza automatyzacją autopilota — operator zaznacza je ręcznie po wykonaniu. Pomiń sekcję jeśli IU nie ma takich kroków

Każdy feature-bearing unit powinien zawierać ścieżkę pliku testowego w `**Pliki:**`. Dla unitów modyfikujących komponenty UI lub ścieżki użytkownika — dołącz scenariusze `[E2E]` opisujące flow do przetestowania przez `/agent-browser` (otwórz URL, zrób snapshot, kliknij X, sprawdź Y, zrób screenshot).

Używaj `Notatka wykonawcza` oszczędnie. Dobre użycia:
- `Notatka wykonawcza: Zacznij od failing integration testu dla kontraktu request/response.`
- `Notatka wykonawcza: Dodaj characterization coverage przed modyfikacją tego legacy parsera.`
- `Notatka wykonawcza: Implementuj nowe zachowanie domenowe test-first.`

Nie rozwijaj unitów w literalne substepy `RED/GREEN/REFACTOR`.

#### 3.5 Wybór subagenta dla IU

Każdy Implementation Unit MUSI mieć zadeklarowany `Delegate to:` — nazwa subagenta z `.claude/agents/`, który go wykona. Reguła decyzyjna oparta na ścieżkach z pola `Pliki:`:

| Ścieżki w `Pliki:` | Subagent | Skille (mirror dla `Skills in play:`) |
|---|---|---|
| Tylko `*.tsx` w `src/components/`, `src/features/<x>/components/`, `src/pages/`, lub `*.css` | `feature-builder-ui` | tailwind-react-guidelines, ux-ui-guidelines, figma:figma-use, figma:figma-implement-design |
| Tylko `*.ts` w `src/lib/`, `src/hooks/use<X>Data.ts`, `supabase/migrations/`, `supabase/functions/` | `feature-builder-data` | supabase-dev-guidelines, security, sentry-integration |
| Mix UI i danych w jednym atomowym IU | `feature-builder-fullstack` | tailwind-react-guidelines, ux-ui-guidelines, supabase-dev-guidelines, security, sentry-integration, figma:figma-use, figma:figma-implement-design |

**Reguła praktyczna:** jeśli da się rozsądnie podzielić na dwa osobne IU (jeden UI, drugi data) — podziel. `feature-builder-fullstack` używaj **tylko** gdy podział byłby sztuczny (np. formularz logowania, gdzie UI bez auth call lub auth call bez formularza są bezużyteczne).

**Figma w mirrorze:** `feature-builder-ui` i `feature-builder-fullstack` zawsze mają figma skille w `Skills in play:` (mirror frontmatera tych agentów). Te skille są aktywne tylko gdy plan ma niepuste `figma_spec`/`figma_screens` w frontmaterze — wtedy `dev-docs-execute` wstrzykuje subagentowi "Mandatory designerski kontekst". Bez tej sekcji w prompcie buildery ignorują skille figma. `feature-builder-data` nie ma figma skilli — warstwa danych nie dotyka designu.

Pole `Skills in play:` jest dokumentacyjnym mirror frontmatter `skills:` wybranego subagenta — pozwala czytelnikowi planu zrozumieć kontekst implementacji bez wchodzenia do pliku subagenta.

#### 3.6 Trzymaj niewiadome planistyczne i implementacyjne oddzielnie

Jeśli coś jest ważne ale jeszcze niepoznawalne, zapisz to explicite pod odroczonymi notatkami implementacyjnymi zamiast udawać że rozwiązujesz to w planie.

Przykłady:
- Dokładne nazwy metod lub helperów
- Finalne szczegóły SQL lub zapytań po dotknięciu prawdziwego kodu
- Zachowanie runtime'owe zależne od zobaczenia faktycznych test failures
- Refaktory które mogą stać się niepotrzebne po rozpoczęciu implementacji

### Faza 4: Napisz plan

Używaj jednej filozofii planowania na wszystkich głębokościach. Zmieniaj ilość szczegółów, nie granicę między planowaniem a wykonaniem.

#### 4.1 Guidance głębokości planu

**Lekka**
- Plan powinien być kompaktowy
- Zazwyczaj 2-4 implementation units
- Pomiń opcjonalne sekcje które dodają mało wartości

**Standardowa**
- Użyj pełnego core template
- Zazwyczaj 3-6 implementation units
- Dołącz ryzyka, odroczone pytania i wpływ systemowy gdy relevantne

**Głęboka**
- Użyj pełnego core template plus opcjonalne sekcje analizy
- Zazwyczaj 4-8 implementation units
- Grupuj unity w fazy gdy to poprawia klarowność
- Dołącz rozważane alternatywy, wpływ na dokumentację i głębsze traktowanie ryzyk gdy uzasadnione

#### 4.1b Opcjonalne rozszerzenia Deep planu

Dla wystarczająco dużej, ryzykownej lub cross-cutting pracy, dodaj sekcje które genuinely pomagają:
- **Rozważane alternatywy**
- **Metryki sukcesu**
- **Zależności / Wymagania wstępne**
- **Analiza ryzyk i mitygacja**
- **Fazowe dostarczanie**
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
origin: docs/brainstorms/YYYY-MM-DD-<topic>-requirements.md  # dołącz gdy planujesz z requirements doc
design_md: ./docs/DESIGN.md          # null jeśli pure-data feature lub brak DESIGN.md (patrz 1.6)
figma_spec: ./docs/plans/<feature-slug>-figma/SPEC.md   # null jeśli brak mockupów Figmy
figma_screens:                       # {} jeśli brak mockupów; mapa name → ścieżka PNG
  home: ./docs/plans/<feature-slug>-figma/home.png
  settings: ./docs/plans/<feature-slug>-figma/settings.png
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

## Implementation Units

- [ ] **Unit 1: [Nazwa]**

**Cel:** [Co ten unit osiąga]

**Wymagania:** [R1, R2]

**Zależności:** [Brak / Unit 1 / zewnętrzny prerequisite]

**Pliki:**
- Stwórz: `ścieżka/do/nowego_pliku`
- Modyfikuj: `ścieżka/do/istniejącego_pliku`
- Test (unit): `ścieżka/do/pliku_testowego`
- Test (e2e): `Scenariusz: [opis flow do weryfikacji przez /agent-browser]`

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
- [E2E] [Flow do weryfikacji przez /agent-browser: otwórz URL, kliknij X, sprawdź Y]
- [Manual] [Krok wymagający człowieka, np. weryfikacja na fizycznym urządzeniu] *(opcjonalne — używaj gdy automatyzacja jest niemożliwa)*

**Weryfikacja:** *(wyłącznie automatyzowalne — CLI lub E2E przez /agent-browser; rzeczy ręczne idą do Operator checklist niżej)*
- [Komenda CLI z oczekiwanym wynikiem, np. "bun run typecheck przechodzi bez błędów"]
- [Scenariusz E2E z oczekiwanym stanem widocznym w przeglądarce]

**Operator checklist:** *(opcjonalne — kroki wymagające człowieka, NIE odznaczane przez autopilot)*
- [ ] [Krok wymagający operatora, np. "QA weryfikuje animację na realnym urządzeniu iOS"]

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

## Zależności / Wymagania wstępne

- [Zależność techniczna, organizacyjna lub rolloutowa]

## Analiza ryzyk i mitygacja

- [Ryzyko]: [Mitygacja]

## Fazowe dostarczanie

### Faza 1
- [Co ląduje pierwsze i dlaczego]

### Faza 2
- [Co następuje i dlaczego]

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
- Jeśli postawa test-first lub characterization-first była explicite lub silnie implikowana, relevantne unity niosą ją dalej z lekką `Notatką wykonawczą`
- Scenariusze testowe są konkretne bez stawania się kodem testowym
- Każdy checkbox `Weryfikacja:` jest automatyzowalny (CLI lub E2E przez agent-browser). Kroki wymagające człowieka są w `Operator checklist` lub jako `[Manual]` w `Scenariusze testowe` — nigdy w `Weryfikacja:`
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

**Tryb pipeline:** Jeśli wywołany z automatycznego workflow lub kontekstu `disable-model-invocation`, pomiń interaktywne pytania. Podejmij potrzebne wybory automatycznie i kontynuuj do zapisu planu.

#### 5.3 Opcje po wygenerowaniu

Po zapisie pliku prezentuj opcje używając narzędzia pytań platformy gdy dostępne. W przeciwnym razie prezentuj numerowane opcje w chacie i czekaj na odpowiedź.

**Pytanie:** "Plan gotowy w `docs/plans/YYYY-MM-DD-NNN-<type>-<name>-plan.md`. Co chciałbyś zrobić dalej?"

**Opcje:**
1. **Otwórz plan w edytorze** — otwórz plik planu do review
2. **Uruchom `/dev-docs`** (Rekomendowane) — rozpocznij planowanie implementacji z tym planem
3. **Uruchom `/dev-docs-execute`** — rozpocznij implementację tego planu
4. **Gotowe na teraz** — wróć później

Na podstawie wyboru:
- **Otwórz plan w edytorze** -> Otwórz `docs/plans/<nazwa_pliku>.md` używając mechanizmu otwierania plików platformy (np. `open` na macOS)
- **`/dev-docs`** -> Uruchom `/dev-docs` ze ścieżką do planu
- **`/dev-docs-execute`** -> Uruchom `/dev-docs-execute` ze ścieżką do planu
- **Inne** -> Przyjmij wolny tekst do rewizji i wróć do opcji

NIGDY NIE KODUJ! Badaj, decyduj i zapisz plan.

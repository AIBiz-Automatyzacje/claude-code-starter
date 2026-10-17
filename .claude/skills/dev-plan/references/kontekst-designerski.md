# Kontekst designerski — kroki B–F (dev-plan 1.6)

Cel: zanim ułożysz IU, ustal źródło prawdy o designie feature'a. Builder UI z samym opisem tekstowym zgaduje pomiary. Wynik trafia do frontmattera planu (`design_md`, `figma_spec`, `figma_screens`), a generator przenosi go do sekcji „Designerski kontekst” pliku kontekstu zadania — planner fazy wkleja ją builderom UI i fullstack i wybiera dla nich wariant `-figma`, gdy `figma_spec` albo `figma_screens` jest niepuste.

## Krok B — DESIGN.md projektu

Sprawdź `docs/DESIGN.md` (Read).

- Istnieje → `design_md: ./docs/DESIGN.md`; ogłoś: „Używam `docs/DESIGN.md` jako źródła tokenów designu projektu.”
- Nie istnieje → `AskUserQuestion`: „Brak `docs/DESIGN.md` (design system projektu w formacie Google Labs design.md — tokeny YAML + opis). Co robimy?”
  1. `Stwórz teraz — zatrzymaj planowanie` (rekomendowane) — kończysz dev-plan z instrukcją utworzenia `docs/DESIGN.md` (spec: https://github.com/google-labs-code/design.md); plan wznowisz później.
  2. `Pomiń w tej iteracji` — `design_md: null` i wpis w „Otwarte pytania → Odroczone do implementacji”: „Brak `docs/DESIGN.md` — buildery UI bazują na ux-ui-guidelines i SPEC feature'a. Utwórz przed kolejnym feature'em UI.”

## Krok C — makiety Figmy tej iteracji

Pierwsze trafienie wygrywa:

1. **Istniejący SPEC** — glob `docs/plans/*-figma/SPEC.md`; folder pasujący do feature'a (ten sam `fileKey` w nagłówku SPEC, zbieżna nazwa albo ten sam dokument źródłowy) → jego slug jest `<feature-slug>`, przejdź do kroku F (ponowny przebieg nie nadpisuje SPEC bez zgody).
2. **Checklista z `/dev-prep`** (0.3) — sekcja „Makiety” to lista ekranów iteracji; rozstrzygasz po polach `URL Figma:`:
   - wszystkie ekrany mają URL → krok D bez pytania, lista `{name, url}` z dokumentu (`name` = nazwa ekranu z sekcji bez zmian — wiąże makietę z pozycją checklisty);
   - część ma URL → wymień ekrany bez URL-a i zapytaj: `Pobierz gotowe, resztę projektujemy z głowy` / `Podam brakujące URL-e` / `Przerywam — dokończę makiety`; przy pierwszej opcji brakujące ekrany idą do „Odroczone do implementacji”;
   - żaden nie ma URL-a, sekcja niepusta → makiety zamówione, niegotowe; zapytaj: `Projektujemy z głowy w oparciu o DESIGN.md` / `Przerywam planowanie do czasu makiet` (rekomendowane przy pozycjach `[blokuje: planowanie]`);
   - sekcja pusta albo `dotyka_ui: false` → `figma_spec: null`, `figma_screens: {}`, dalej Faza 2.
3. **Linki w źródle** — URL-e `figma.com/design/...` w requeście albo dokumencie źródłowym → krok D bez pytania.
4. W pozostałych przypadkach jedno pytanie: „Czy masz w Figmie makiety ekranów tej iteracji?” — `Tak — podam linki` (krok D) / `Nie — projektujemy z głowy w oparciu o DESIGN.md` (`figma_spec: null`, `figma_screens: {}`).

## Krok D — linki per ekran

Poproś wolnym tekstem o URL-e per ekran lub komponent, po jednym w linii, w formacie `<nazwa>: <url>`:

```
home-dashboard: https://figma.com/design/abc123/...?node-id=378-43
bottom-nav: https://figma.com/design/abc123/...?node-id=27-119
```

Sparsuj na `{name, fileKey, nodeId}` (`figma.com/design/<fileKey>/...?node-id=<nodeId>`, w `nodeId` zamień `-` na `:`).

## Krok E — pobranie: agenci w częściach, SPEC per ekran

Przed zapisem sprawdź `docs/plans/<feature-slug>-figma/`: folder istnieje, a w kroku F nie padło `Pobierz ponownie i nadpisz` → krok F.

Pobranie robią subagenci (`general-purpose`), nie sesja planowania, w częściach po kolei (limit zapytań serwera Figma MCP): do 8 ekranów — jeden agent, 9–16 — dwa, więcej — trzy; ekrany dzielisz równo w kolejności listy. Jeden agent na wszystkie ekrany etapu (23 ekrany, 81 tur) doszedł do 414k kontekstu i 2,26 M, bo każda odpowiedź `get_design_context` (do 94k znaków i zrzut ekranu) zostawała w kontekście do końca pracy.

Każdy agent dostaje: `fileKey`, swoją listę `{name, nodeId}`, folder `docs/plans/<feature-slug>-figma/`, ścieżkę `docs/DESIGN.md` i pliku z tokenami `@theme` projektu oraz polecenie (pełne nazwy narzędzi zależą od podłączenia Figmy — plugin albo konektor claude.ai; agent ładuje je przez ToolSearch i przed pierwszym `get_design_context` ładuje skill `figma:figma-design-to-code`):

```text
Dla każdego ekranu z listy, po kolei:
1. get_screenshot (fileKey, nodeId, maxDimension 1600 dla ekranu szerszego niż 600 px, 1200 dla telefonu) → zapis PNG:
   curl -sSL -o <folder>/<name>.png "<image_url>"; sprawdź `file <folder>/<name>.png` = PNG. PNG nie otwierasz narzędziem Read:
   obraz zostaje w kontekście na resztę pracy, a SPEC opisujesz z danych get_design_context.
2. get_design_context (fileKey, nodeId, clientFrameworks: react, clientLanguages: typescript, excludeScreenshot: true) — zrzut
   jest już w pliku z kroku 1, więc odpowiedź bez obrazu. Odpowiedź oznaczona jako sparse → get_design_context widocznych dzieci
   (też excludeScreenshot: true).
3. Zapisz <folder>/ekrany/<name>.md: nagłówek `# <name> (`<nodeId>`) — <W>×<H>px`, hierarchia frame'a, pomiary (szerokości,
   paddingi, odstępy, promienie, autoLayout), typografia (font, rozmiar, waga, interlinia), kolory jako nazwy zmiennych Figmy,
   wszystkie teksty dosłownie (etykiety, nagłówki, placeholdery, komunikaty błędów, przyciski). Następny ekran zaczynasz
   dopiero po zapisie pliku — z odpowiedzi narzędzia korzystasz tylko przy jego ekranie.
Agent pierwszej części: get_variable_defs jednego reprezentatywnego ekranu → <folder>/tokeny.md (tabela
`figma_variable | hex | token w projekcie`; brakujące w DESIGN.md oznacz „do dodania w DESIGN.md”).
Wynik: wiersz na ekran `<name> | <W>×<H> | <nodeId>` i wiersze rozjazdów z DESIGN.md gotowe do tabeli
`element | DESIGN.md | Figma | decyzja` (albo „brak rozjazdów”), bez pomiarów — wynik wraca do kontekstu sesji planowania,
a pomiary są w plikach ekranów.
```

Z wyników agentów piszesz `docs/plans/<feature-slug>-figma/SPEC.md` — indeks bez pomiarów ekranów (builder czyta go razem z SPEC swoich ekranów):

```markdown
# <Feature> — Specyfikacja Figma

> Pomiary pobrane z Figmy YYYY-MM-DD (`get_design_context` + `get_variable_defs`).
> Źródło: Figma `<fileKey>`.

## Screeny referencyjne

| Nazwa | Plik | SPEC ekranu | Wymiary | Frame |
|---|---|---|---|---|
| <name> | `./<name>.png` | `./ekrany/<name>.md` | <W>×<H>px | `<nodeId>` |

## Tokeny (Figma variables → `docs/DESIGN.md` lub `@theme {}` w global.css)

[Treść `tokeny.md` przeniesiona tutaj; plik `tokeny.md` usuwasz.]

## Rozjazdy vs DESIGN.md — Figma jest źródłem prawdy

[Tabela `element | DESIGN.md | Figma | decyzja` z wyników agentów; bez rozjazdów: „Brak rozjazdów w chwili pobrania.”]
```

Datę w nagłówku SPEC bierzesz z `date +%F`. Każda IU ui/fullstack dostaje pole `**Makiety:**` z nazwami ekranów, które buduje (`—`, gdy żadnego) — planner wkleja builderowi SPEC i PNG tylko tych ekranów (`plan.mjs designerski`). Do frontmattera planu:

```yaml
figma_spec: ./docs/plans/<feature-slug>-figma/SPEC.md
figma_screens:
  <name-1>: ./docs/plans/<feature-slug>-figma/<name-1>.png
```

## Krok F — SPEC już istnieje

`AskUserQuestion`: „SPEC.md już istnieje. Co robimy?”

1. `Pobierz ponownie i nadpisz` — identyfikatory z tabeli „Screeny referencyjne” istniejącego SPEC (`fileKey` z nagłówka, `nodeId` z kolumny Frame); nowe linki w źródle albo niepełna tabela → krok D, potem E.
2. `Użyj istniejącego` (rekomendowane, gdy w Figmie nic się nie zmieniło) — kroki E pomijasz, ścieżki z istniejącego folderu.

SPEC i PNG nadpisujesz tylko po wyborze opcji 1.

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

## Krok E — pobranie i SPEC.md

Przed zapisem sprawdź `docs/plans/<feature-slug>-figma/`: folder istnieje, a w kroku F nie padło `Pobierz ponownie i nadpisz` → krok F.

Dla każdego ekranu, po kolei (limit zapytań serwera Figma MCP), wywołaj narzędzia serwera Figma MCP — pełne nazwy zależą od podłączenia Figmy (plugin albo konektor claude.ai):

1. `get_design_context` z `fileKey` + `nodeId` — hierarchia, pomiary, paddingi, typografia, autoLayout; `width` i `height` frame'a to viewport designu ekranu;
2. `get_variable_defs` z `fileKey` + `nodeId` — tokeny (kolory, spacing, fonty) użyte w frame;
3. `get_screenshot` z `fileKey` + `nodeId` — PNG zapisany jako `docs/plans/<feature-slug>-figma/<name>.png`.

Potem jeden plik `docs/plans/<feature-slug>-figma/SPEC.md`:

```markdown
# <Feature> — Specyfikacja Figma

> Pomiary pobrane z Figmy YYYY-MM-DD (`get_design_context` + `get_variable_defs`).
> Źródło: Figma `<fileKey>`.

## Screeny referencyjne

| Nazwa | Plik | Wymiary | Frame |
|---|---|---|---|
| <name> | `./<name>.png` | <W>×<H>px | `<nodeId>` |

## Tokeny (Figma variables → `docs/DESIGN.md` lub `@theme {}` w global.css)

[Tabela `figma_variable | hex | token w projekcie`; brakujące w DESIGN.md oznacz „do dodania w DESIGN.md”.]

## <NAZWA EKRANU> (`<nodeId>`) — pełny ekran

[Sekcja per komponent: paddingi, fonty, kolory, autoLayout — struktura frame'a 1:1.]

## Rozjazdy vs DESIGN.md — Figma jest źródłem prawdy

[Tabela `element | DESIGN.md | Figma | decyzja`; bez rozjazdów: „Brak rozjazdów w chwili pobrania.”]
```

Datę w nagłówku SPEC bierzesz z `date +%F`. Do frontmattera planu:

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

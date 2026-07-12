---
name: dev-docs-execute
description: "Kontynuacja pracy nad zadaniem - wykonanie kolejnej fazy/etapu."
argument-hint: "[ścieżka-do-folderu np. 'docs/active/auth-refaktor']"
---

# Wykonanie kolejnej fazy zadania

## Wykonanie

Ustal `sciezka` (folder zadania w `docs/active/`, np. z argumentu `$1`) i `faza` (numer fazy). Jeśli `faza` nie została podana jawnie, wylicz ją jako **pierwszą nieukończoną fazę** na podstawie checkboxów w `$sciezka/*-zadania.md`.

URUCHOM workflow toolem Workflow:

```
Workflow({scriptPath: ".claude/workflows/dev-docs-execute-wf.js", args: {sciezka, faza}})
```

Po zakończeniu workflow streść użytkownikowi wynik: numer fazy, `status` (completed/partial/blocked), status poszczególnych Implementation Units, commity, wynik testów, odchylenia od planu.

**NIE wykonuj procedury ręcznie** — mechanika (planner buduje listę Implementation Units z planu technicznego, buildery `feature-builder-*` implementują je delegacją przez `agentType`, krok domknięcia waliduje/commituje/aktualizuje dokumentację) żyje w workflow. Sekcje referencyjne poniżej są używane PRZEZ workflow — jego sub-agenty czytają je bezpośrednio z tego pliku — nie przez Ciebie.

### 2.5 Strategia delegacji do subagentów

KAŻDY Implementation Unit z fazy MUSI być wykonany przez subagenta zadeklarowanego w polu `Delegate to:` w planie technicznym. NIE implementuj IU samodzielnie poza fallbackiem opisanym niżej.

**Krok 1 — Wczytaj plan techniczny.** Otwórz plan w `docs/plans/` (referencja w pliku z planem zadania jako `Plan techniczny:` lub `origin:`). Zlokalizuj IU odpowiadające bieżącej fazie.

**Krok 2 — Wybierz strategię orkiestracji** (to jest strategia jak orkiestrować delegacje, NIE strategia implementacji — implementacją zajmuje się subagent):

- **Serial** (domyślne) — IU mają zależności między sobą lub modyfikują wspólne pliki. Wywołuj Agent tool dla każdego IU sekwencyjnie: czekaj na raport, weryfikuj status, kontynuuj do kolejnego.
- **Parallel** — IU są niezależne (różne pliki, brak współdzielonego stanu, brak ordering constraint). Wywołuj Agent tool dla wszystkich IU naraz w jednym multi-call (kilka tool uses w jednej wiadomości).
- **Inline fallback** — TYLKO gdy IU nie ma `Delegate to:` (legacy plan sprzed reformy delegacji) lub jest trywialny (literówka w stringu, zmiana jednej stałej). W każdym innym przypadku NIE używaj inline.

**Krok 3 — Dla każdego IU wywołaj Agent tool:**
- `subagent_type` = wartość pola `Delegate to:` z IU (`feature-builder-ui` | `feature-builder-data` | `feature-builder-fullstack`)
- `prompt` = cały blok IU dosłownie (Cel, Wymagania, Pliki, Podejście, Wzorce, Scenariusze testowe, Weryfikacja) + ścieżka do dokumentacji zadania (`$1`) + numer IU + **mandatory designerski kontekst** (patrz krok 3a).

**Krok 3a — Mandatory designerski kontekst (gdy subagent to `feature-builder-ui` lub `feature-builder-fullstack`):**

Odczytaj `$1/[nazwa-zadania]-kontekst.md` i wyciągnij sekcję "Designerski kontekst". Jeśli sekcja istnieje i zawiera niepuste ścieżki, **DOKLEJ** do promptu Agent tool blok:

```
## Mandatory designerski kontekst (przeczytaj PRZED implementacją)

- DESIGN.md (projekt-wide tokeny): <ścieżka z design_md, lub "brak — bazuj na ux-ui-guidelines">
- SPEC.md (per-feature pomiary z Figmy): <ścieżka z figma_spec, lub "brak — projektujesz w oparciu o DESIGN.md">
- Screeny referencyjne (PNG):
  - <name-1>: <ścieżka>
  - <name-2>: <ścieżka>

Te pliki są źródłem prawdy o designie. SPEC.md > DESIGN.md > ux-ui-guidelines (od najbardziej konkretnego do najbardziej ogólnego). Jeśli SPEC.md nie pokrywa pomiaru — dopytaj Figmę przez `mcp__plugin_figma_figma__get_design_context` (fileKey/nodeId z nagłówka SPEC.md). Nigdy nie zgaduj wymiarów.
```

Jeśli sekcja "Designerski kontekst" nie istnieje LUB wszystkie pola są null/puste → pomiń krok 3a (feature pure-data lub świadoma decyzja "bez Figmy"). Dla subagenta `feature-builder-data` zawsze pomijaj krok 3a (warstwa danych nie konsumuje designu).

**Krok 4 — Po otrzymaniu raportu od subagenta zweryfikuj `Status:`**

- `completed` → zaloguj raport w pliku z kontekstem zadania, kontynuuj do kolejnego IU
- `partial` → przeczytaj `Następne kroki dla orkiestratora`. Jeśli to nowy IU do dodania w planie — zatrzymaj fazę, zaktualizuj plan przez `/dev-plan` lub bezpośredni edit, zaraportuj user'owi. Jeśli to niedokończona praca w obecnym IU — STOP, raportuj user'owi.
- `blocked` → STOP, przedstaw user'owi pytanie subagenta, czekaj na decyzję.

**Jeśli raport zawiera `Odchylenia od planu:`** (cokolwiek poza "Brak") → zaloguj odchylenie w pliku z kontekstem; jeśli odchylenie zmienia scope (nowe pliki, inne wzorce) — STOP i potwierdź z user'em zanim ruszysz dalej.

### 3. Wykonaj TYLKO JEDNĄ fazę
- Sprawdź czy w planie (`docs/plans/`) lub w pliku z planem zadania istnieje sekcja "Granice scope'u" / "Poza zakresem"
- Jeśli tak → przeczytaj ją i NIE implementuj niczego co jest tam wymienione, nawet jeśli wydaje się przydatne
- Jeśli zadanie wymaga pracy poza zakresem → STOP, poinformuj użytkownika
- Checkboxy z prefixem `Weryfikacja:` NIE wykonuj — zostaną zweryfikowane wizualnie w przeglądarce podczas `/dev-docs-review`
- Realizuj zadania z fazy zgodnie ze strategią delegacji z sekcji 2.5 (Agent tool z `subagent_type` z pola `Delegate to:` IU). Testy są pisane przez subagenta razem z kodem (część jego workflow) — nie zlecaj ich osobno
- NIE przechodź do następnych faz
- Zatrzymaj się po ukończeniu tej jednej fazy

### 4.5 System-Wide Test Check
Przed zamknięciem fazy odpowiedz na 5 pytań:
1. Czy typecheck przechodzi bez nowych błędów?
2. Czy istniejące testy nadal przechodzą?
3. Czy nowe testy pokrywają happy path i przynajmniej jeden error case?
3b. Czy checklist fazy zawierał checkboxy testowe (`Test:`)? Jeśli tak — czy odpowiadające testy zostały napisane i przechodzą? Jeśli nie zostały napisane — napisz je TERAZ przed zamknięciem fazy.
4. Czy nowe importy nie łamią istniejących modułów?
5. Czy build przechodzi?

Jeśli odpowiedź na którekolwiek pytanie to NIE — napraw przed kontynuacją.

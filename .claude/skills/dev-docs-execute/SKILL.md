---
name: dev-docs-execute
description: "Kontynuacja pracy nad zadaniem - wykonanie kolejnej fazy/etapu."
argument-hint: "[ścieżka-do-folderu np. 'docs/active/auth-refaktor']"
---

# Wykonanie kolejnej fazy zadania

## Zmienne
- ŚCIEŻKA_ZADANIA: $1

## Instrukcje

### 0. Walidacja git
1. **Sprawdź aktualny branch:** `git branch --show-current`
2. **Przeczytaj wymagany branch** z dokumentacji w `$1/` (szukaj "Branch:" w plikach)
3. **Porównaj:**
   - Jeśli branch się zgadza → kontynuuj
   - Jeśli branch się nie zgadza → poinformuj użytkownika i zapytaj czy przełączyć
4. **Sprawdź czy nie ma niezacommitowanych zmian** z poprzednich sesji

### 1. Zapoznaj się z dokumentacją zadania
Przeczytaj wszystkie pliki `.md` w `$1/`:
- Plik z planem (zawiera fazy, cele, kryteria)
- Plik z kontekstem (decyzje, stan, notatki)
- Plik z zadaniami (lista ze statusami ✅/⬜)

### 2. Określ aktualny stan
Na podstawie pliku z zadaniami:
- Znajdź ostatnią ukończoną fazę/etap (oznaczoną ✅)
- Zidentyfikuj NASTĘPNĄ fazę/etap do wykonania
- Jeśli wszystko ukończone → poinformuj użytkownika i zakończ

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

### 4. Walidacja i testy
Po zakończeniu fazy:
- Sprawdź czy w planie są zdefiniowane testy akceptacyjne dla tej fazy
- Jeśli tak → wykonaj je
- Zapisz wyniki testów i zrzuty ekranu w `$1/`

### 4.5 System-Wide Test Check
Przed zamknięciem fazy odpowiedz na 5 pytań:
1. Czy typecheck przechodzi bez nowych błędów?
2. Czy istniejące testy nadal przechodzą?
3. Czy nowe testy pokrywają happy path i przynajmniej jeden error case?
3b. Czy checklist fazy zawierał checkboxy testowe (`Test:`)? Jeśli tak — czy odpowiadające testy zostały napisane i przechodzą? Jeśli nie zostały napisane — napisz je TERAZ przed zamknięciem fazy.
4. Czy nowe importy nie łamią istniejących modułów?
5. Czy build przechodzi?

Jeśli odpowiedź na którekolwiek pytanie to NIE — napraw przed kontynuacją.

### 5. Aktualizuj dokumentację
**W pliku z zadaniami:**
- Oznacz ukończone zadania jako ✅
- Dodaj nowo odkryte zadania (jeśli są)

**W pliku z kontekstem:**
- Dodaj zmiany wprowadzone w tej fazie
- Zapisz podjęte decyzje
- Zaktualizuj "Ostatnia aktualizacja: RRRR-MM-DD"

### 5.5 Aktualizacja planu technicznego
Jeśli istnieje plan techniczny w `docs/plans/`:
- Znajdź Implementation Unit odpowiadający ukończonej fazie
- Zaktualizuj checkboxy test scenarios (odznacz spełnione)
- Zaktualizuj checkboxy verification (odznacz spełnione)
- Plan staje się żywym dokumentem śledzenia postępu

### 6. Commit zmian (inkrementalny)
Heurystyka: commituj gdy możesz napisać sensowny commit message opisujący kompletną zmianę.
- Nie czekaj do końca fazy — commituj logiczne jednostki pracy
- Jeśli commit message brzmiałby "WIP" lub "partial" — nie commituj jeszcze
- Pattern: `feat/fix/refactor([nazwa-zadania]): [co i dlaczego]`
- Jedna faza może mieć wiele commitów lub jeden — zależy od złożoności
- Staguj tylko pliki związane z daną jednostką pracy (nie `git add .`)

### 7. Przygotuj podsumowanie
Napisz podsumowanie w **prostym języku** zrozumiałym dla osoby nietechnicznej:
```
## Podsumowanie fazy [numer/nazwa]

### Co zostało zrobione
[Opis w prostych słowach, bez żargonu technicznego]

### Co widać w aplikacji
**Desktop:**
- [Widoczne zmiany dla użytkownika]

**Mobile:**
- [Widoczne zmiany dla użytkownika]

### Zmiany "pod maską" (backend/kod)
[Wyjaśnij DLACZEGO te zmiany były ważne, nawet jeśli niewidoczne]

### Następny krok
[Jaka faza/etap jest następny]

```

## Format wyjściowy
```
✅ Ukończono fazę [numer/nazwa] w $1

🔀 Branch: [nazwa-brancha]

📋 Wykonane Implementation Units:
   - IU-{N}: {nazwa} → {subagent} → {status}
   - IU-{N+1}: {nazwa} → {subagent} → {status}

🧪 Testy akceptacyjne: [PASS/FAIL/brak testów]

📁 Zapisane pliki:
   - [zrzuty ekranu, logi, inne]

📝 Zaktualizowana dokumentacja w $1/

⚠️ Odchylenia od planu (zgłoszone przez subagentów):
   - [lub "Brak"]

💾 Commit: feat([nazwa-zadania]): [opis]

---

[PODSUMOWANIE W PROSTYM JĘZYKU]

---

➡️ Review ukończonej fazy:
   Uruchom: /dev-docs-review $1 Faza [numer]
```
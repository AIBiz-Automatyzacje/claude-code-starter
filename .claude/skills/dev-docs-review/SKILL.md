---
name: dev-docs-review
description: "Code review wykonanej fazy/etapu przez multi-agent analysis."
argument-hint: "[ścieżka-do-folderu] [numer-fazy]"
---

# Code Review fazy zadania

## Wykonanie

Ustal `sciezka` (folder zadania w `docs/active/`, np. z argumentu `$1`) i `faza` (numer fazy, np. z argumentu `$2`; jeśli nie podano — pierwsza faza z niezaznaczonymi checkboxami `Weryfikacja:` lub ostatnia ukończona przez `/dev-docs-execute`).

URUCHOM workflow toolem Workflow:

```
Workflow({scriptPath: ".claude/workflows/dev-docs-review-wf.js", args: {sciezka, faza}})
```

Po zakończeniu workflow streść użytkownikowi wynik: severity gate (BLOKUJE / ZASTRZEŻENIA / CZYSTE), liczniki findingów (P1/P2/P3, w tym OPERATOR), wynik E2E (passed/failed/skipped), ścieżkę zapisanego raportu.

**NIE wykonuj procedury ręcznie** — mechanika (7 reviewerów + adversarial verify / delegacja IU do builderów) żyje w workflow; sekcje referencyjne poniżej są używane PRZEZ workflow, nie przez Ciebie.

### 1. Walidacja
- Sprawdź czy folder `$1/` istnieje
- Sprawdź zmiany w git: `git status --short`
- Jeśli folder nie istnieje → poinformuj użytkownika i zakończ

### 2. Przygotowanie kontekstu
Przeczytaj dokumentację zadania z `$1/`:
- Plan zadania (cele, wymagania, kryteria akceptacji)
- Plik z zadaniami (co miało być zrobione w fazie $2)
- Plik kontekstowy (decyzje, zmiany)

**Cross-reference z planem technicznym:**
Jeśli istnieje plan w `docs/plans/`:
- Przeczytaj Implementation Unit odpowiadający tej fazie
- Przekaż każdemu agentowi review: jakie pliki miały być zmienione (Files:), jakie testy miały być napisane (Test scenarios:), jakie wzorce miały być naśladowane (Patterns to follow:)
- Sprawdź czy Implementation Unit definiował ścieżki plików testowych w sekcji **Pliki: Test:**. Jeśli tak — zweryfikuj czy te pliki istnieją. Brakujący plik testowy zdefiniowany w planie = 🟠 [P2-important] w raporcie "Odchylenia od planu"
- Sprawdź czy IU miało wypełnione `Delegate to:`. Brak pola w IU sprzed reformy delegacji = ⚪ [info] (legacy plan, nie blokuje review). Niezgodność `Delegate to:` z faktyczną kategorią plików (np. UI files w IU oznaczonym `feature-builder-data`) = 🟡 [P3-nit] z notatką dla planisty
- Dodaj do raportu sekcję "Odchylenia od planu" jeśli implementacja różni się od planu

### 4. Zapisz wyniki review
Po zakończeniu review przez subagenta:

**Utwórz plik `$1/review-faza-$2.md`** z pełnym raportem. Umieść w nim **osobną sekcję `## Zgodność ze spec`** z wynikami Agenta 6 — NIE scalaj jej z findings osi Standards (osie pozostają rozdzielone, by jedna nie maskowała drugiej).

**Zaktualizuj `$1/[zadanie]-zadania.md`:**
- Dodaj sekcję "## Do poprawy po review fazy $2"
- Wylistuj wszystkie 🔴 i 🟠 problemy jako **checkboxy** (nie bullet points!):
```markdown
  ## Do poprawy po review fazy $2

  - [ ] 🔴 [blocking] **plik:linia** — opis problemu
  - [ ] 🟠 [important] **plik:linia** — opis problemu
  - [ ] 🟡 [nit] **plik:linia** — opis (opcjonalne)
```
- Format musi być spójny z pozostałymi zadaniami w pliku

**Zaktualizuj `$1/[zadanie]-kontekst.md`:**
- Dodaj notatkę o przeprowadzonym review
- Zapisz kluczowe wnioski

### 4.5 Decyzja severity gate
Na podstawie skonsolidowanego raportu:
- **Jeśli są P1 (blocking):** "⛔ WYMAGA POPRAWEK — znaleziono X problemów P1 blokujących kontynuację"
- **Jeśli tylko P2 (important):** "⚠️ KONTYNUUJ Z ZASTRZEŻENIAMI — X problemów P2 do naprawy"
- **Jeśli tylko P3 (nit):** "✅ GOTOWE DO KONTYNUACJI — X sugestii do rozważenia"

### 4.7 Bookkeeping checkboxów `Weryfikacja:`

**Cel kroku:** każdy `- [ ] Weryfikacja:` w fazie $2 musi mieć rozstrzygnięcie po review — albo `[x]` (przeszedł), albo `[ ]` z adnotacją kto ma to zrobić. Bez tego kroku trywialne `Weryfikacja: bun run typecheck` zostają wiecznie niezaznaczone mimo że quality gate je potwierdził.

**Krok 1: Re-parsuj plik zadań.** Otwórz `$1/*-zadania.md`, znajdź sekcję fazy $2, wyciągnij wszystkie wciąż niezaznaczone wiersze pasujące do regex `^\s*-\s*\[\s*\]\s*Weryfikacja:`.

**Krok 2: Sklasyfikuj każdy checkbox** — dopasuj treść do jednej z kategorii (kolejność dopasowania od góry, zatrzymaj się na pierwszej pasującej):

| Kategoria | Sygnały w treści checkboxa | Akcja |
|---|---|---|
| **CLI** | `bun run`, `npm run`, `pnpm`, `yarn`, `make`, `tsc`, `vitest`, `bun test`, `cargo`, `pytest`, `ruff`, `eslint` | Uruchom komendę przez Bash. Jeśli exit 0 → odznacz `[x]`. Jeśli != 0 → zostaw `[ ]`, dopisz suffix ` (FAIL: <skrót błędu>)` i dodaj wpis do raportu jako 🟠 [P2-important]. |
| **Grep / istnienie pliku** | `grep`, `rg`, `test -f`, `ls`, "brak referencji do", "plik istnieje", "import nie istnieje" | Uruchom przez Bash. PASS → `[x]`. FAIL → `[ ]` z suffixem ` (FAIL)` i wpis P2. |
| **E2E browser** | URL, `agent-browser`, "viewport", "kliknij", "screenshot", oznaczenie 🌐 | Sprawdź wynik Agent 5 z findings typu E2E/OPERATOR zwróconych przez workflow. PASS → `[x]`. FAIL → `[ ]` (P2 już zarejestrowany jako finding). SKIP / niewykonalny headless → `[ ]` z suffixem ` (SKIP — <powód>)` i wpis do Operator checklist zamiast P2. |
| **Manual** | "ręcznie", "operator", "symulator", "device", "emulator", "QA", "tester człowiek" | Zostaw `[ ]`. Dopisz suffix ` — wymaga operatora (checklist)`. NIE dodawaj do P2 — to oczekiwana ręczna weryfikacja. |
| **Niejasne** | nic z powyższych nie pasuje | Zostaw `[ ]`. Dopisz suffix ` — klasyfikacja niejasna, wymaga ręcznej decyzji`. Dodaj do raportu jako 🟡 [P3-nit] z notatką dla planisty: "checkbox nieautomatyzowalny — rozważ przeniesienie do Operator checklist (dev-plan §3.4) lub przeformułowanie na CLI/E2E". |

**Krok 3: Zaktualizuj plik zadań.** Edytuj `$1/*-zadania.md` przez Edit tool — dla każdego checkboxa zamień `- [ ]` na `- [x]` jeśli PASS, lub dopisz odpowiedni suffix przy `- [ ]` zgodnie z klasyfikacją. Nie modyfikuj checkboxów spoza fazy $2.

**Krok 4: Zaktualizuj raport review.** W `$1/review-faza-$2.md` dopisz sekcję na końcu raportu:

```markdown
## Bookkeeping checkboxów Weryfikacja:

- Odznaczone automatycznie (CLI/grep): X
- Odznaczone na podstawie Agent 5 E2E: Y
- Pozostawione dla operatora (Manual): Z
- Niejasne (P3): W
- Failujące (P2): V

### Szczegóły
- [x] CLI: `<treść>` → PASS (komenda: `<komenda>`)
- [ ] Manual: `<treść>` — wymaga operatora
- [ ] Niejasne: `<treść>` — wymaga przeformułowania w planie
- [ ] FAIL: `<treść>` — `<skrót błędu>` (P2)
```

**Krok 5: Re-aktualizuj severity gate.** Jeśli krok 2 dodał nowe P2 (CLI FAIL, E2E SKIP, Grep FAIL) lub P3 (niejasne) — zaktualizuj liczniki w raporcie i ponownie zastosuj decyzję severity gate z sekcji 4.5.

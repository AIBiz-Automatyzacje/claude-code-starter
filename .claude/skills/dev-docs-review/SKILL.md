---
name: dev-docs-review
description: "Code review wykonanej fazy/etapu przez multi-agent analysis."
argument-hint: "[ścieżka-do-folderu] [numer-fazy]"
---

# Code Review fazy zadania

## Zmienne
- ŚCIEŻKA_ZADANIA: $1
- NUMER_FAZY: $2

## Instrukcje

### 1. Walidacja
- Sprawdź czy folder `$1/` istnieje
- Sprawdź zmiany w git: `git status --short`
- Jeśli folder nie istnieje → poinformuj użytkownika i zakończ

### 2. Przygotowanie kontekstu
Przeczytaj dokumentację zadania z `$1/`:
- Plan zadania (cele, wymagania, kryteria akceptacji)
- Plik z zadaniami (co miało być zrobione w fazie $2)
- Plik kontekstowy (decyzje, zmiany)

### 3. Uruchom agentów review równolegle

**Cross-reference z planem technicznym:**
Jeśli istnieje plan w `docs/plans/`:
- Przeczytaj Implementation Unit odpowiadający tej fazie
- Przekaż każdemu agentowi review: jakie pliki miały być zmienione (Files:), jakie testy miały być napisane (Test scenarios:), jakie wzorce miały być naśladowane (Patterns to follow:)
- Sprawdź czy Implementation Unit definiował ścieżki plików testowych w sekcji **Pliki: Test:**. Jeśli tak — zweryfikuj czy te pliki istnieją. Brakujący plik testowy zdefiniowany w planie = 🟠 [P2-important] w raporcie "Odchylenia od planu"
- Sprawdź czy IU miało wypełnione `Delegate to:`. Brak pola w IU sprzed reformy delegacji = ⚪ [info] (legacy plan, nie blokuje review). Niezgodność `Delegate to:` z faktyczną kategorią plików (np. UI files w IU oznaczonym `feature-builder-data`) = 🟡 [P3-nit] z notatką dla planisty
- Dodaj do raportu sekcję "Odchylenia od planu" jeśli implementacja różni się od planu

Uruchom 6 agentów (Task) równolegle, każdy z inną perspektywą:

**Agent 1: Security Review**
```
Jesteś security reviewer. Przeczytaj `.claude/agents/security-sentinel.md` i zastosuj jego metodologię.
Sprawdź zmiany z fazy $2 w folderze $1.
Skup się na: auth, RLS policies, XSS, data exposure, Zod validation, API key exposure.
Klasyfikuj: 🔴 [P1-blocking], 🟠 [P2-important], 🟡 [P3-nit]
```

**Agent 2: Performance Review**
```
Jesteś performance reviewer. Przeczytaj `.claude/agents/performance-oracle.md` i zastosuj jego metodologię.
Sprawdź zmiany z fazy $2 w folderze $1.
Skup się na: N+1 queries, bundle size, lazy loading, memoization, useEffect cleanup.
Klasyfikuj: 🔴 [P1-blocking], 🟠 [P2-important], 🟡 [P3-nit]
```

**Agent 3: Architecture & Code Quality**
```
Jesteś architecture reviewer. Przeczytaj `.claude/agents/architecture-strategist.md` i `.claude/agents/kieran-typescript-reviewer.md`.
Sprawdź zmiany z fazy $2 w folderze $1.
Skup się na: SOLID, wzorce, nazewnictwo, type safety, import organization.
Klasyfikuj: 🔴 [P1-blocking], 🟠 [P2-important], 🟡 [P3-nit]
```

**Agent 4: Scenario Exploration & Test Coverage**
```
Jesteś tester scenariuszy. Dla zmian z fazy $2 w folderze $1, sprawdź:
- [ ] Happy path — główny flow działa poprawnie
- [ ] Invalid inputs — walidacja, error messages
- [ ] Boundary conditions — puste listy, max wartości, null/undefined
- [ ] Concurrent operations — race conditions, optimistic updates
- [ ] Scale — co jeśli 100x więcej danych?
- [ ] Test coverage — czy plan techniczny definiował scenariusze testowe
  dla tej fazy? Jeśli tak, czy odpowiadające pliki testowe istnieją
  i zawierają asercje? Brakujące testy = 🟠 [P2-important].
Klasyfikuj znalezione problemy: 🔴 [P1-blocking], 🟠 [P2-important], 🟡 [P3-nit]
```

**Agent 5: E2E Browser Verification**
```
Jesteś testerem E2E. Przeczytaj `.claude/agents/feature-tester-e2e.md` i zastosuj jego metodologię.
Zbierz niezaznaczone checkboxy `Weryfikacja:` z fazy $2 w pliku zadań $1, które dotyczą scenariuszy w przeglądarce (URL, viewport, kliknięcia, screenshoty, oznaczenie 🌐).
Pomiń checkboxy CLI (bun run, npm run, grep, tsc itp.) i Manual (operator, symulator, device) — zostaną obsłużone w kroku 4.7.
Zweryfikuj każdy E2E scenariusz wizualnie przez agent-browser.
Zwróć USTRUKTURYZOWANY wynik per scenariusz w formacie:
  - {treść checkboxa} → passed | failed | skipped (z powodem dla skipped)
Klasyfikuj findingi: ✅ passed, 🟠 [P2-important] failed, ⚪ skipped (np. brak dev servera).
```

**Agent 6: Spec Compliance**
```
Jesteś recenzentem zgodności ze spec. To OSOBNA oś review — sprawdzasz, czy diff faktycznie realizuje to, o co prosił spec, a nie czy kod jest dobrej jakości (tym zajmują się Agenci 1-5).
Wejście: requirements doc (`docs/dev-brainstorms/*-requirements.md`) i/lub Implementation Unit z planu (`docs/plans/`) odpowiadający fazie $2, oraz zmiany z fazy $2 w folderze $1.
Zgłoś trzy rzeczy, każdą z CYTATEM linii spec / IU (np. ID wymagania R3 lub nazwa IU):
(a) wymagania ze spec/IU BRAKUJĄCE lub częściowo zaimplementowane,
(b) zachowanie w diffie, o które NIKT nie prosił (scope creep),
(c) wymagania pozornie zaimplementowane, ale BŁĘDNIE.
Jeśli nie ma spec ani planu — pomiń i zwróć "brak spec do weryfikacji".
Klasyfikuj: 🔴 [P1-blocking], 🟠 [P2-important], 🟡 [P3-nit].
```

Po zakończeniu wszystkich agentów — **skonsoliduj wyniki:**
- Zbierz findings z Agentów 1-5 (oś Standards: bezpieczeństwo, performance, architektura, scenariusze, E2E)
- Usuń duplikaty (różne agenty mogą znaleźć ten sam problem)
- Posortuj po severity: P1 → P2 → P3
- **Wyniki Agenta 6 (oś Spec) trzymaj OSOBNO** — NIE scalaj ich z findings Standards i nie dedupuj między osiami. Rozdzielenie jest celowe: zmiana może przejść jedną oś i oblać drugą (kod zgodny z konwencjami, ale realizujący złą rzecz — i odwrotnie), a scalanie maskuje jedną przez drugą

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

### 4.6 Wyniki weryfikacji E2E
Jeśli Agent 5 wykonał weryfikacje:
- Dołącz wyniki E2E do skonsolidowanego raportu (sekcja z screenshotami)
- Nieudane weryfikacje wchodzą do severity gate jako 🟠 [P2-important]
- Zachowaj wynik per scenariusz E2E w mapie `{treść checkboxa: passed|failed|skipped}` — krok 4.7 wykorzysta to przy klasyfikacji E2E
- Krok 4.7 fizycznie odznaczy checkboxy `Weryfikacja:` w pliku zadań (nie odznaczaj ich tutaj)

### 4.7 Bookkeeping checkboxów `Weryfikacja:`

**Cel kroku:** każdy `- [ ] Weryfikacja:` w fazie $2 musi mieć rozstrzygnięcie po review — albo `[x]` (przeszedł), albo `[ ]` z adnotacją kto ma to zrobić. Bez tego kroku trywialne `Weryfikacja: bun run typecheck` zostają wiecznie niezaznaczone mimo że quality gate je potwierdził.

**Krok 1: Re-parsuj plik zadań.** Otwórz `$1/*-zadania.md`, znajdź sekcję fazy $2, wyciągnij wszystkie wciąż niezaznaczone wiersze pasujące do regex `^\s*-\s*\[\s*\]\s*Weryfikacja:`.

**Krok 2: Sklasyfikuj każdy checkbox** — dopasuj treść do jednej z kategorii (kolejność dopasowania od góry, zatrzymaj się na pierwszej pasującej):

| Kategoria | Sygnały w treści checkboxa | Akcja |
|---|---|---|
| **CLI** | `bun run`, `npm run`, `pnpm`, `yarn`, `make`, `tsc`, `vitest`, `bun test`, `cargo`, `pytest`, `ruff`, `eslint` | Uruchom komendę przez Bash. Jeśli exit 0 → odznacz `[x]`. Jeśli != 0 → zostaw `[ ]`, dopisz suffix ` (FAIL: <skrót błędu>)` i dodaj wpis do raportu jako 🟠 [P2-important]. |
| **Grep / istnienie pliku** | `grep`, `rg`, `test -f`, `ls`, "brak referencji do", "plik istnieje", "import nie istnieje" | Uruchom przez Bash. PASS → `[x]`. FAIL → `[ ]` z suffixem ` (FAIL)` i wpis P2. |
| **E2E browser** | URL, `agent-browser`, "viewport", "kliknij", "screenshot", oznaczenie 🌐 | Sprawdź wynik Agent 5 z mapy zachowanej w 4.6. PASS → `[x]`. FAIL → `[ ]` (P2 już zarejestrowany w 4.6). SKIP → `[ ]` z suffixem ` (SKIP — Agent 5 niedostępny: <powód>)` i wpis P2. |
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

### 5. Przedstaw podsumowanie użytkownikowi

## Format wyjściowy
```
✅ Code Review fazy $2 zakończony

📊 Statystyki:
   - Plików sprawdzonych: X
   - 🔴 [blocking]: X
   - 🟠 [important]: X
   - 🟡 [nit]: X
   - 🔵 [suggestion]: X
   - 🌐 [E2E]: X passed / Y failed
   - ☑️ Weryfikacja: X auto / Y E2E / Z manual / W niejasne / V failed
   - 📋 Zgodność ze spec: X braków / Y scope creep / Z błędnie zaimplementowane

📄 Raport zapisany: $1/review-faza-$2.md

📝 Zadania do poprawy dodane do: $1/[zadanie]-zadania.md

---

[PODSUMOWANIE GŁÓWNYCH PROBLEMÓW]

---

❓ Czy wykonać poprawki teraz? (tak/nie)
   Jeśli tak → uruchom: /dev-docs-execute $1
```
---
name: dev-compound
description: "Dokumentowanie rozwiązanego problemu do bazy wiedzy docs/solutions/."
argument-hint: "[opcjonalnie: opis problemu lub --full]"
---

# Compound — dokumentowanie rozwiązanego problemu

**Uwaga: Aktualny rok to 2026.** Używaj tego przy datowaniu dokumentów.

Przechwytuje rozwiązania problemów gdy kontekst jest świeży, tworząc ustrukturyzowaną dokumentację w `docs/solutions/` z YAML frontmatter dla wyszukiwalności i przyszłego odniesienia.

**Dlaczego "compound"?** Każde udokumentowane rozwiązanie kumuluje wiedzę zespołu. Pierwszy raz rozwiązanie problemu wymaga researchu. Udokumentuj go, a następne wystąpienie zajmie minuty. Wiedza się kumuluje.

## Użycie

```bash
/dev-compound                    # Dokumentuj najnowszą naprawę (tryb compact)
/dev-compound [krótki kontekst]  # Podaj dodatkowy opis problemu (tryb compact)
/dev-compound --full             # Pełny format z diagnostyką i kontekstem
```

## Opis problemu

<problem_description> #$ARGUMENTS </problem_description>

## Strategia wykonania

**Domyślny tryb: compact** — szybki, bez pytań, autonomiczny. Przejdź bezpośrednio do trybu Compact.

Tryb `--full` to rozszerzony format z pełną diagnostyką — patrz sekcja **Tryb Full** poniżej. Używaj go gdy użytkownik explicite poda `--full`.

---

## Tryb Compact (domyślny)

<critical_requirement>
**Jeden plik wyjściowy — finalna dokumentacja.**

Nie twórz żadnych plików tymczasowych. Wszystko odbywa się w jednym przebiegu.
</critical_requirement>

Agent wykonuje WSZYSTKO w jednym sekwencyjnym przebiegu:

### Krok 1: Wyciągnij kontekst z bieżącej sesji

Autonomicznie zbierz kontekst — nie pytaj użytkownika.

**Bez argumentów:**
- Przejrzyj historię rozmowy w bieżącej sesji
- Uruchom `git diff` i `git diff --cached` żeby zobaczyć ostatnie zmiany
- Zidentyfikuj problem, root cause i rozwiązanie z kontekstu sesji

**Z argumentem (ale bez --full):**
- Użyj podanego opisu jako punkt wyjścia
- Uzupełnij kontekstem z sesji i git diff

### Krok 2: Przeczytaj auto memory

Przeczytaj MEMORY.md z katalogu auto memory (ścieżka znana z kontekstu systemowego).
- Jeśli katalog lub MEMORY.md nie istnieje, jest pusty lub nieczytelny — pomiń ten krok
- Przeskanuj wpisy pod kątem powiązań z dokumentowanym problemem
- Jeśli znajdziesz relevantne wpisy, użyj ich jako dodatkowy kontekst. Oznacz treści pochodzące z memory tagiem "(auto memory [claude])"
- Priorytet mają dane z rozmowy i codebase — memory to uzupełnienie

### Krok 3: Sklasyfikuj kategorię

Określ kategorię na podstawie problemu. Dostępne kategorie:

- `build-errors/` — błędy kompilacji, bundlera, konfiguracji build
- `runtime-errors/` — błędy w czasie wykonania, crashe, unhandled exceptions
- `supabase-issues/` — problemy z Supabase (auth, RLS, queries, migrations)
- `auth-issues/` — problemy z autentykacją i autoryzacją
- `ui-bugs/` — błędy wizualne, layout, responsywność, interakcje
- `performance-issues/` — wolne zapytania, memory leaks, re-rendery
- `typescript-errors/` — błędy typów, type assertions, generics
- `deployment-issues/` — problemy z wdrożeniem, CI/CD, environment
- `testing-issues/` — failing testy, konfiguracja testów, mocking

Określ filename: `YYYY-MM-DD-kebab-case-title.md`

### Krok 4: Zapisz dokumentację

Utwórz katalog: `mkdir -p docs/solutions/[category]/`

Zapisz plik `docs/solutions/[category]/YYYY-MM-DD-kebab-case-title.md` w formacie:

```markdown
---
title: "Zwięzły opis problemu"
date: YYYY-MM-DD
category: kategoria
severity: low | medium | high | critical
stack:
  - React
  - TypeScript
  - Supabase
  - Tailwind
  - Vite
tags:
  - tag1
  - tag2
status: verified
last_verified: YYYY-MM-DD
---

# Tytuł problemu

## Symptomy

- Dokładne komunikaty błędów
- Obserwowalne zachowanie

## Root Cause

Techniczna analiza przyczyny (1-3 zdania).

## Rozwiązanie

Krok po kroku z przykładami kodu:

\```typescript
// kod rozwiązania
\```

## Komendy diagnostyczne

\```bash
# komendy pomocne przy diagnozie
\```

## Zapobieganie

- Jak uniknąć tego problemu w przyszłości

## Powiązane

- Linki do powiązanych docs w `docs/solutions/`
- Linki do issues jeśli relevantne

## Kontekst

Dodatkowe informacje o okolicznościach, środowisku, wersji.
```

Dostosuj sekcje `stack` i `tags` do faktycznego stosu technologicznego problemu. Nie wstawiaj pełnego stacka jeśli problem dotyczy tylko jednej technologii.

### Krok 4.5: Zaktualizuj słownik domenowy (docs/CONCEPTS.md)

Sprawdź, czy w tej sesji pojawił się lub uściślił **termin domenowy o znaczeniu specyficznym dla projektu** (encja, nazwany proces, status/enum o niestandardowym sensie). Jeśli tak — dodaj/zaktualizuj jedno hasło w `docs/CONCEPTS.md`.

**Zasady słownika (trzymaj się ściśle):**
- **Cienki indeks**: hasło = 1-2 zdania definicji + opcjonalny link do szczegółów (`→ [nazwa](../CLAUDE.md#kotwica)`). Nie kopiuj wiedzy z CLAUDE.md — linkuj.
- **Tylko domenowe**: pojęcia biznesowe/projektowe, zwłaszcza **kontrintuicyjne** (np. status „refund" liczony jako aktywny). NIE dodawaj pojęć technicznych/generycznych — te idą do `docs/solutions/` lub `learned-patterns`.
- **Alfabetycznie**, jeden `## Termin` na hasło, dedup przed dodaniem.
- **Glosariusz, nie spec** — jeśli hasło wymaga akapitów, to nie jest hasło słownika.

**Bootstrap (pierwsze uruchomienie w projekcie):** jeśli `docs/CONCEPTS.md` nie istnieje, a projekt ma bogatą domenę (statusy/enumy o niestandardowym znaczeniu, nazwane procesy), wygeneruj startowy słownik: przeczytaj `CLAUDE.md` + schemat bazy/migracje + definicje enumów/statusów w kodzie, wyciągnij 5-15 najważniejszych pojęć projektowo-specyficznych i zapisz plik wg formatu poniżej. Zgłoś użytkownikowi, że utworzono seed do przeglądu.

Format pliku:

```markdown
# Concepts — słownik domenowy <projekt>

Glosariusz pojęć o znaczeniu specyficznym dla tego projektu (encje, nazwane procesy, statusy).
Jedno hasło = zwięzła definicja + opcjonalny link do CLAUDE.md/docs. Tylko słownik, nie spec.
Narasta przez /dev-compound, porządkowany przez /dev-compound-refresh.

## <Termin>
<1-2 zdania — co znaczy w TYM projekcie, zwłaszcza gdy kontrintuicyjne>. → [szczegóły](../CLAUDE.md#...)
```

Jeśli nie pojawił się żaden termin domenowy — pomiń ten krok (to normalne dla większości sesji).

### Krok 5: Podsumowanie

Wyświetl podsumowanie:

```
Dokumentacja zapisana (tryb compact)

Plik: docs/solutions/[category]/[filename].md

Aby uzyskać bogatszą dokumentację (cross-referencje, diagnostyka, strategia zapobiegania),
uruchom /dev-compound --full w świeżej sesji.

[Jeśli dodano regułę:]
Reguła: Dodana do .claude/rules/learned-patterns.md
```

### Krok 6: Ocena i dodanie reguły do learned-patterns

Po zapisaniu dokumentacji, autonomicznie oceń czy rozwiązany problem zasługuje na regułę w `.claude/rules/learned-patterns.md`. Nie pytaj użytkownika — zdecyduj sam.

**Kryteria rule-worthy (problem spełnia minimum 2 z 5):**

1. **Ryzyko powtórzenia** — błąd łatwo popełnić ponownie bo API/zachowanie jest nieintuicyjne lub słabo udokumentowane
2. **Wysoka waga** — problem powodował ciche błędy, lukę bezpieczeństwa, utratę danych lub trudne do debugowania zachowanie
3. **Prosty wzorzec** — regułę da się wyrazić w 1-3 liniach jako "rób X, nie Y"
4. **Szerokie zastosowanie** — wzorzec dotyczy przyszłego kodu w tym stacku, nie jednorazowej migracji czy typo
5. **Niewidoczna luka wiedzy** — problem nie manifestuje się oczywistym błędem; cicho daje złe wyniki lub ujawnia się dopiero w produkcji/strict mode

**Jeśli rule-worthy:**

1. Przeczytaj `.claude/rules/learned-patterns.md` (jeśli istnieje)
2. Sprawdź czy nie istnieje już zduplikowana lub bardzo podobna reguła — jeśli tak, pomiń
3. Odczytaj aktualny rule-count z komentarza `<!-- rule-count: N -->`
4. Jeśli N >= 50: NIE dodawaj nowej reguły. Zanotuj w podsumowaniu że limit został osiągnięty i zasugeruj `/dev-compound-refresh`
5. Jeśli plik nie istnieje, stwórz go z nagłówkiem:
   ```markdown
   # Learned Patterns

   Reguły wyciągnięte z rozwiązanych problemów w docs/solutions/. Zarządzane przez /dev-compound i /dev-compound-refresh.

   <!-- rule-count: 0 -->
   ```
6. Dodaj regułę na końcu pliku:
   ```markdown
   - **[Zwięzły tytuł wzorca]**: [1-2 zdania actionable guidance: "rób X, nie Y"]
     Source: docs/solutions/[category]/[filename].md
   ```
7. Zaktualizuj `<!-- rule-count: N -->` na `<!-- rule-count: N+1 -->`

**Jeśli NIE jest rule-worthy:** pomiń ten krok cicho, nie dodawaj nic do podsumowania.

---

## Tryb Full

<critical_requirement>
**Tylko JEDEN plik zostaje zapisany — finalna dokumentacja.**

Faza 1 zwraca DANE TEKSTOWE do orkiestratora. Subagenci NIE mogą używać Write, Edit ani tworzyć plików. Tylko orkiestrator (Faza 2) zapisuje finalny plik dokumentacji.
</critical_requirement>

### Faza 0.5: Skan Auto Memory

Przed uruchomieniem Fazy 1, sprawdź katalog auto memory pod kątem notatek powiązanych z dokumentowanym problemem.

1. Przeczytaj MEMORY.md z katalogu auto memory (ścieżka znana z kontekstu systemowego)
2. Jeśli katalog lub MEMORY.md nie istnieje, jest pusty lub nieczytelny — pomiń i przejdź do Fazy 1
3. Przeskanuj wpisy pod kątem powiązań z dokumentowanym problemem — użyj oceny semantycznej, nie dopasowania słów kluczowych
4. Jeśli znajdziesz relevantne wpisy, przygotuj blok kontekstu:

```
## Notatki uzupełniające z auto memory
Traktuj jako dodatkowy kontekst, nie główne dowody. Historia rozmowy
i wyniki analizy codebase mają priorytet nad tymi notatkami.

[relevantne wpisy]
```

5. Przekaż ten blok jako dodatkowy kontekst do Analizatora kontekstu i Ekstraktora rozwiązania w Fazie 1. Jeśli notatki z memory trafią do finalnej dokumentacji, oznacz je tagiem "(auto memory [claude])"

Jeśli nie znaleziono relevantnych wpisów, przejdź do Fazy 1 bez przekazywania kontekstu memory.

### Faza 1: Równoległy research

<parallel_tasks>

Uruchom te zadania RÓWNOLEGLE. Każde zwraca dane tekstowe do orkiestratora.

#### 1. **Analizator kontekstu**
   - Wyciąga historię rozmowy
   - Identyfikuje typ problemu, komponent, symptomy
   - Uwzględnia notatki z auto memory (jeśli przekazane) jako dodatkowe dowody
   - Waliduje przeciwko schematowi
   - Zwraca: szkielet YAML frontmatter

#### 2. **Ekstraktor rozwiązania**
   - Analizuje wszystkie kroki diagnostyczne
   - Identyfikuje root cause
   - Wyciąga działające rozwiązanie z przykładami kodu
   - Uwzględnia notatki z auto memory jako dodatkowe dowody — historia rozmowy i zweryfikowana naprawa mają priorytet; jeśli notatki z memory są sprzeczne z rozmową, zaznacz sprzeczność jako ostrzeżenie
   - Zwraca: blok treści rozwiązania

#### 3. **Wyszukiwarka powiązanych dokumentów**
   - Przeszukuje `docs/solutions/` pod kątem powiązanej dokumentacji
   - Identyfikuje cross-referencje i linki
   - Znajduje powiązane GitHub issues
   - Oznacza powiązane dokumenty, które mogą być przestarzałe, sprzeczne lub zbyt ogólne
   - Zwraca: linki, relacje i kandydatów do odświeżenia

#### 4. **Strateg zapobiegania**
   - Opracowuje strategie zapobiegania
   - Tworzy wytyczne best practices
   - Generuje przypadki testowe jeśli to ma sens
   - Zwraca: treść zapobiegania/testowania

#### 5. **Klasyfikator kategorii**
   - Określa optymalną kategorię w `docs/solutions/`
   - Waliduje kategorię przeciwko schematowi
   - Sugeruje filename na podstawie sluga
   - Zwraca: finalną ścieżkę i nazwę pliku

</parallel_tasks>

### Faza 2: Montaż i zapis

<sequential_tasks>

**POCZEKAJ na zakończenie wszystkich zadań Fazy 1 przed kontynuacją.**

Orkiestrujący agent (główna rozmowa) wykonuje te kroki:

1. Zbierz wszystkie wyniki tekstowe z Fazy 1
2. Zmontuj kompletny plik markdown ze zebranych elementów
3. Zwaliduj YAML frontmatter przeciwko schematowi
4. Utwórz katalog jeśli potrzeba: `mkdir -p docs/solutions/[category]/`
5. Zapisz JEDEN finalny plik: `docs/solutions/[category]/[filename].md`

Format pliku jest taki sam jak w trybie Compact, ale z bogatszą treścią:
- Bardziej szczegółowe symptomy i kroki diagnostyczne
- Pełna analiza root cause
- Rozbudowane przykłady kodu
- Kompletne komendy diagnostyczne
- Strategie zapobiegania z przypadkami testowymi
- Cross-referencje do powiązanych dokumentów
- Pełny kontekst środowiska

</sequential_tasks>

### Po zapisie: ocena odświeżenia

Po zapisie nowego dokumentu, oceń czy starsze dokumenty mogą wymagać odświeżenia.

Odświeżenie ma sens gdy:
1. Powiązany dokument rekomenduje podejście, które nowa naprawa teraz podważa
2. Nowa naprawa wyraźnie zastępuje starsze udokumentowane rozwiązanie
3. Bieżąca praca obejmowała refaktor, migrację lub upgrade zależności
4. Wyszukiwarka powiązanych dokumentów wskazała kandydatów do odświeżenia

Odświeżenie **nie** ma sensu gdy:
1. Nie znaleziono powiązanych dokumentów
2. Powiązane dokumenty są spójne z nową wiedzą
3. Pokrywanie się jest powierzchowne

Jeśli widzisz oczywistego kandydata do odświeżenia, wspomnij o tym w podsumowaniu i zasugeruj uruchomienie `/dev-compound-refresh` z wąskim scope.

### Po zapisie: aktualizacja słownika domenowego

Zastosuj **Krok 4.5** także w trybie full — jeśli w sesji pojawił się termin domenowy o projektowo-specyficznym znaczeniu, dodaj/zaktualizuj hasło w `docs/CONCEPTS.md` (cienki indeks + link; utwórz plik z nagłówkiem jeśli nie istnieje).

### Po zapisie: ocena i dodanie reguły do learned-patterns

Identyczna logika jak Krok 6 w trybie Compact — autonomicznie oceń czy problem jest rule-worthy (minimum 2 z 5 kryteriów), sprawdź duplikaty i limit ~50, dodaj regułę do `.claude/rules/learned-patterns.md` jeśli zasługuje. Jeśli plik nie istnieje — stwórz z nagłówkiem. Format reguły i kryteria opisane w Kroku 6 trybu Compact.

---

## Co przechwytuje

- **Symptomy problemu**: dokładne komunikaty błędów, obserwowalne zachowanie
- **Kroki diagnostyczne**: co nie zadziałało i dlaczego
- **Analiza root cause**: techniczna analiza
- **Działające rozwiązanie**: krok po kroku z przykładami kodu
- **Strategie zapobiegania**: jak uniknąć w przyszłości
- **Cross-referencje**: linki do powiązanych issues i dokumentów

## Warunki wstępne

<preconditions enforcement="advisory">
  <check condition="problem_solved">
    Problem został rozwiązany (nie w trakcie)
  </check>
  <check condition="solution_verified">
    Rozwiązanie zostało zweryfikowane jako działające
  </check>
  <check condition="non_trivial">
    Nietrywialny problem (nie prosty typo czy oczywisty błąd)
  </check>
</preconditions>

## Co tworzy

**Zorganizowana dokumentacja:**

- Plik: `docs/solutions/[category]/[filename].md`

**Kategorie auto-wykrywane z problemu:**

- build-errors/
- runtime-errors/
- supabase-issues/
- auth-issues/
- ui-bugs/
- performance-issues/
- typescript-errors/
- deployment-issues/
- testing-issues/

## Typowe błędy do unikania

| Źle | Dobrze |
|-----|--------|
| Subagenci tworzą pliki jak `context-analysis.md`, `solution-draft.md` | Subagenci zwracają dane tekstowe; orkiestrator zapisuje jeden finalny plik |
| Research i montaż działają równolegle | Research się kończy, potem montaż |
| Tworzenie wielu plików w workflow | Jeden plik: `docs/solutions/[category]/[filename].md` |
| Pytania do użytkownika w trybie compact | Tryb compact działa autonomicznie, bez pytań |

## Output sukcesu (tryb full)

```
Dokumentacja zapisana

Auto memory: 2 relevantne wpisy użyte jako dodatkowy kontekst

Wyniki zadań:
  - Analizator kontekstu: Zidentyfikowano runtime_error w module auth
  - Ekstraktor rozwiązania: 2 poprawki kodu
  - Wyszukiwarka powiązanych: 1 powiązany dokument
  - Strateg zapobiegania: Strategie zapobiegania, sugestie testów
  - Klasyfikator kategorii: `auth-issues`

Plik: docs/solutions/auth-issues/2026-03-24-supabase-rls-policy-bypass.md

Reguła: [Dodana do .claude/rules/learned-patterns.md / Limit osiągnięty / Nie rule-worthy]

Ta dokumentacja będzie wyszukiwalna jako referencja gdy podobne
problemy pojawią się w przyszłości.

Następne kroki:
1. Kontynuuj pracę (rekomendowane)
2. Połącz powiązaną dokumentację
3. Zaktualizuj inne referencje
4. Wyświetl dokumentację
5. Inne
```

## Filozofia kumulowania wiedzy

System kumulowania wiedzy:

1. Pierwszy raz rozwiązujesz "N+1 query w generowaniu raportów" -> Research (30 min)
2. Dokumentujesz rozwiązanie -> docs/solutions/performance-issues/n-plus-one-reports.md (5 min)
3. Następnym razem podobny problem -> Szybki lookup (2 min)
4. Wiedza się kumuluje -> Zespół staje się mądrzejszy

Pętla feedbacku:

```
Build -> Test -> Znajdź problem -> Research -> Popraw -> Dokumentuj -> Waliduj -> Deploy
    ^                                                                                |
    '--------------------------------------------------------------------------------'
```

**Każda jednostka pracy inżynieryjnej powinna ułatwiać kolejne jednostki pracy — nie utrudniać.**

## Auto-wywołanie

<auto_invoke> <trigger_phrases> - "zadziałało" - "naprawione" - "działa" - "problem rozwiązany" - "fixed" - "it works" </trigger_phrases>

<manual_override> Użyj /dev-compound [kontekst] żeby dokumentować natychmiast bez czekania na auto-detekcję. </manual_override> </auto_invoke>

## Powiązane komendy

- `/dev-brainstorm [temat]` - Walidacja pomysłu i brainstorming
- `/dev-docs [temat]` - Planowanie implementacji
- `/dev-compound-refresh [scope]` - Odświeżenie istniejącej dokumentacji solutions

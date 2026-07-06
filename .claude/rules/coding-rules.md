## 1. Rozmiar plików i funkcji

### Reguły

- Plik > 300 linii = refaktoruj. Podziel na mniejsze moduły
- Funkcja > 50 linii = wyciągnij pod-funkcje. Jedna funkcja = jeden poziom abstrakcji
- Funkcja > 6 argumentów = stwórz obiekt konfiguracyjny / interfejs
- Nesting > 2 poziomy = użyj early return
- Klasa > 1 odpowiedzialność = podziel (Single Responsibility Principle)
---

## 2. Testowanie

### Reguły

- NIGDY nie modyfikuj istniejących testów żeby "naprawić" failing test — napraw implementację
- NIGDY nie usuwaj testów, chyba że usuwasz testowaną funkcjonalność
- NIGDY nie osłabiaj asercji (np. `toBe(429)` na `toBeDefined()`) — to nie jest fix
- NIGDY nie mockuj tego co testujesz — mockuj TYLKO zewnętrzne serwisy
- Każdy test MUSI mieć minimum 1 asercję — zero assertion-free testów
- Każda nowa funkcja = minimum 1 test happy path + 1 test error case
- Po napisaniu kodu uruchom testy PRZED deklaracją "gotowe"
- Nie ładuj pełnych datasetów w unit testach — używaj fixtures w `tests/fixtures/`
- Pattern: Arrange-Act-Assert wewnątrz describe/it bloków
- Testuj ZACHOWANIE (behavior), nie implementację (internal state)
- Pisz testy WERTYKALNIE (tracer bullets): jeden test → jego implementacja → następny. NIGDY nie pisz wszystkich testów naraz, a potem całej implementacji (horizontal slicing) — to produkuje testy „kształtu" (struktur i sygnatur), nie zachowania; przechodzą, gdy zachowanie się psuje
- Nigdy nie refaktoruj, gdy test jest RED — najpierw doprowadź do GREEN
---

## 3. Organizacja kodu

### Reguły

- Jedna odpowiedzialność per moduł/klasa/funkcja
- Kolokacja: testy obok plików źródłowych, nie w osobnym drzewie
- Wyciągaj shared logic do dedykowanego modułu zamiast duplikować
- Nie twórz abstrakcji "na przyszłość" — abstrakcja dopiero gdy jest 2+ użycia
- Nie twórz konfiguracji dla wartości które nigdy się nie zmienią
- Importy: grouped (stdlib, third-party, local), sorted alphabetically
- Jeden eksport per plik dla głównych modułów
---

## 4. Error handling

### Reguły

- NIGDY nie łap wyjątków i nie ignoruj ich (empty catch block)
- NIGDY nie używaj pustego `catch {}` — zawsze loguj albo re-throw
- Rzucaj typed errors, nie string messages (`throw new AppError(...)`, nie `throw "coś poszło nie tak"`)
- Fail fast — waliduj inputy na początku funkcji
- Nie over-catchuj — łap KONKRETNE typy błędów, nie generyczne `Error`
- API routes: ustandaryzowany format odpowiedzi `{ data, error: { code, message } }`
- Używaj structured logging (JSON format, np. pino), nie `console.log`
- Nie suppressuj błędów — finding zawsze wymaga naprawy, nie racjonalizacji
---

## 5. Anty-patterny specyficzne dla AI

### Reguły (zapobieganie)

- Nie zakładaj że biblioteka jest dostępna — sprawdź package.json / cargo.toml / requirements.txt PRZED użyciem
- Nie dodawaj importów które nie są używane
- Nie twórz "defensive code" na scenariusze które nie mogą wystąpić
- Nie rób refaktoryzacji 160 plików na podstawie vague comment — PYTAJ o potwierdzenie
- Nie modyfikuj swoich własnych reguł / review scripts / hooks
- Kiedy test failuje — napraw KOD, nie test
- Kiedy linter failuje — napraw KOD, nie konfigurację lintera
- Nie obchodź blokad przez zmianę narzędzia (Edit zablokowany, więc sed, python -c)
- Nie podejmuj autonomous decisions przy niejasnych instrukcjach — PYTAJ
- Nie dismissuj findings jako "pre-existing" — napraw albo zgłoś

### Katalog 10 udokumentowanych anty-patternów AI

| # | Anty-pattern | Częstość | Opis |
|---|-------------|----------|------|
| 1 | Over-specification | 80-90% | Implementuje funkcje których nikt nie żądał |
| 2 | Test weakening | Wysoka | Osłabia asercje żeby testy przeszły |
| 3 | Silent threshold change | Wysoka | Obniża coverage/quality targets zamiast naprawiać kod |
| 4 | Governance bypass | Średnia | Znajduje luki we własnych regułach |
| 5 | Schema regression | Średnia | Robi masowe refaktoryzacje bez potwierdzenia |
| 6 | Assertion-free tests | Wysoka | Pisze testy bez asercji — coverage rośnie, weryfikacja = 0 |
| 7 | Finding dismissal | Wysoka | "To jest pre-existing code" zamiast naprawy |
| 8 | Tool-switching circumvention | Średnia | Edit zablokowany, więc próbuje sed/echo/python -c |
| 9 | Context blindness | Wysoka w długich sesjach | Duplikuje logikę, niespójne nazewnictwo |
| 10 | Defensive over-engineering | 80-90% | Dodaje konfiguracje, abstrakcje, error handling dla scenariuszy które nie istnieją |
---

## 6. Self-check / Code review

### Reguły

- Po zakończeniu zmian ZAWSZE uruchom: typecheck, test, lint (w tej kolejności)
- Przed commitem sprawdź czy nie dodajesz: secrets, .env, console.log, TODO/FIXME
- Sprawdź czy każdy nowy plik ma odpowiadający test
- Sprawdź czy nie duplikujesz istniejącej logiki — grep codebase
- Sprawdź dead code — usuwaj nieużywane importy, zmienne, funkcje
- Sprawdź magic numbers — wyciągnij do named constants
- Sprawdź deep nesting — max 2 poziomy, powyżej = early return
- Nie committuj zmian chyba że user explicite o to poprosi

### Quality gate (pre-commit checklist)

1. Wszystkie testy przechodzą
2. Zero błędów typecheckera
3. Zero błędów lintera
4. Brak nowych `any` types
5. Brak hardcoded secrets/keys
6. Brak console.log w produkcyjnym kodzie
7. Każda nowa funkcja publiczna ma test
---

## 7. Nazewnictwo

### Reguły

- Boolean: prefix `is` / `has` / `should` / `can` (`isActive`, `hasPermission`, `shouldRetry`)
- Event handlers: prefix `handle` (`handleClick`, `handleSubmit`)
- Stałe: `UPPER_SNAKE_CASE`
- Typy/Interfejsy: `PascalCase`, bez prefixu `I`
- Funkcje i zmienne: `camelCase`
- Pliki: kebab-case (`user-service.ts`, nie `UserService.ts`) — chyba że framework wymusza inną konwencję
- Nazwy powinny opisywać CO robi, nie JAK (`getUserById`, nie `fetchAndParseAndValidateUser`)
- Unikaj akronimów i skrótów chyba że powszechnie znane (`url`, `id` OK; `usrMgr` nie)
---

## 8. Zależności i importy

### Reguły

- NIGDY nie zakładaj że biblioteka jest dostępna — sprawdź package.json / requirements.txt / go.mod
- NIGDY nie instaluj nowych zależności bez poinformowania usera
- Preferuj istniejące biblioteki w projekcie > nowa dependency
- Nie mieszaj package managerów (jeśli projekt używa `bun` — nie używaj `npm`)
- Importy grouped: stdlib, third-party, local
- Nie importuj bezpośrednio między packages w monorepo — używaj shared layer
- Pinuj wersje — deklaruj exact versions w package.json
---

## 9. Bezpieczeństwo

### Reguły

- NIGDY nie committuj secrets, API keys, credentials, tokenów
- NIGDY nie loguj secrets ani danych osobowych
- NIGDY nie konkatenuj user input do SQL queries — używaj parametrized queries
- NIGDY nie używaj dynamicznego wykonywania kodu z user input
- NIGDY nie deserializuj niezaufanych danych z zewnętrznych źródeł
- NIGDY nie autoryzuj po `user_metadata` (Supabase) — jest edytowalne przez usera (`supabase.auth.updateUser`), więc RLS na tym polu = privilege escalation. Rolę trzymaj w `app_metadata` (server-side) lub dedykowanej tabeli ról; nie używaj też top-level claimu `role`
- Waliduj KAŻDY input na granicy API (Zod, Pydantic, etc.)
- Minimum privileges — nie dawaj więcej uprawnień niż potrzeba
- Nie uruchamiaj `rm -rf` bez explicit user confirmation
- Nie modyfikuj production database bezpośrednio
- Rate limiting na KAŻDYM public endpoint
---

## 10. Type safety

### Reguły

- NIGDY nie używaj `any` — użyj `unknown` z type guards albo zdefiniuj interfejs
- NIGDY nie używaj type assertions (`as`) chyba że konieczne dla DOM narrowing
- NIGDY nie używaj non-null assertions (`!`) — obsłuż nullability explicite
- Użyj discriminated unions dla stanu, nie boolean flags
- Wszystkie publiczne funkcje mają explicit return types
- Strict mode ON — `"strict": true` w tsconfig
- Generics > type assertions
- Zod/io-ts na granicach systemu (API, pliki, user input)
---

## 11. Filozofia review kodu

### Reguły

- Istniejący kod — bądź surowy. Każda dodana złożoność wymaga uzasadnienia
- Nowy izolowany kod — bądź pragmatyczny. Jeśli działa i jest testowalny, nie blokuj postępu
- Duplication > Complexity — prosta duplikacja kodu jest LEPSZA niż złożona abstrakcja DRY
- Dodanie nowego modułu nie jest nigdy problemem. Zrobienie modułu zbyt złożonym — jest
- Przy modyfikacji istniejącego pliku pytaj: "Czy ta zmiana sprawia, że istniejący kod jest trudniejszy do zrozumienia?"
- Preferuj ekstrakcję do nowego modułu/komponentu zamiast komplikowania istniejącego
- 5-sekundowa reguła nazewnictwa — jeśli nie rozumiesz co robi funkcja/komponent w 5 sekund od nazwy, to zła nazwa
---

## 12. Performance

### Reguły

- O(n²) lub gorzej = wymaga uzasadnienia komentarzem dlaczego nie da się lepiej
- Pętla z fetchem/zapytaniem do bazy = N+1 query. Użyj batch/join/include
- Nie ładuj pełnych kolekcji gdy potrzebujesz subset — użyj pagination, limit, select konkretnych kolumn
- Nowa dependency = uzasadnienie rozmiaru bundle (sprawdź bundlephobia)
- Dynamic import / React.lazy() dla komponentów > 50KB
- Nie optymalizuj przedwcześnie — ale MIERZ przed deklaracją "to wystarczy"
---

## 13. Async i race conditions

### Reguły

- useEffect z async = ZAWSZE AbortController w cleanup function
- setTimeout / setInterval = ZAWSZE cleanup w useEffect return (clearTimeout/clearInterval)
- Więcej niż 1 boolean do stanu ładowania = użyj state machine (discriminated union)
- Promise.allSettled gdy odpalasz równoległe operacje które mogą niezależnie failować
- Promise.finally() do cleanup i state transitions — nie duplikuj logiki w resolve i reject
- requestAnimationFrame w pętli = sprawdź cancel flag przed kolejnym requestAnimationFrame
- Operacje wzajemnie wykluczające się (np. load preview) = zablokuj następną dopóki poprzednia się nie zakończy lub nie sfailuje
---

## 14. Architektura

### Reguły

- Zero circular dependencies między modułami — jeśli A importuje B, B nie może importować A
- Respect layer boundaries — komponent UI nie woła bazy bezpośrednio, idzie przez serwis/hook
- Single Responsibility dotyczy też plików — plik z komponentem nie zawiera logiki biznesowej
- API contracts (interfejsy, typy propsów) są stabilne — zmiana interfejsu = świadoma decyzja, nie side-effect refaktoru
- Nowa zależność między modułami = pytanie: "czy to nie tworzy nieodwracalnego couplingu?".
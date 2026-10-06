# P12 — coding-rules.md wiersz po wierszu (propozycje do decyzji operatora)

**Data:** 2026-10-06 (P12 sesja 1). **Status:** ZDECYDOWANE (sekcja „Decyzje” na końcu — tam różnice względem tabeli); tabela = propozycja przed recenzją.
**Źródła:** ETAP2 `rekomendacje` + ustalenia researchu (`dane/etap2-research/research-coding-rules-2026.txt`, „ust. N” = N-te ustalenie z URL),
PROMPT-AUDIT PA-26 (a)–(e), INSPIRACJE A1 (wyjątek §2, pytanie „undefined”), A4 (cel pozytywny zamiast negacji), PLAN-POPRAWY P12.
**Co już pilnuje maszyna (P6, `.claude/templates/bramki/eslint.config.szablon.ts` + bramki):** `max-lines` 360 i `max-lines-per-function` 60
(bez pustych linii i komentarzy), `no-explicit-any` (error), `no-non-null-assertion` (warn → lista code-quality), `no-floating-promises`, `no-empty`
(także pusty catch), `no-console`, `no-unused-vars` (TS), `import-x/order`, `import-x/no-cycle`, `react-hooks` recommended-latest (Compiler),
klient Supabase poza warstwą prezentacji (`no-restricted-imports`), vitest: `expect-expect`, `no-conditional-expect`, `prefer-called-with`;
bramki: typecheck, knip (martwy kod, nieużywane eksporty i zależności), size-limit, niezmienność migracji, advisors, usunięte testy, Stryker.
**Pomiar ładowania:** telemetria smoke'a R-P11 (`wf_18c9ceff-8ad`) — każdy z 25 agentów (także haiku, sceptyk, compound) ma w kontekście
`rules_zn` 10 542 zn (coding-rules projektu z załączników transkryptu).

Legenda: **ZOSTAW** (treść bez zmian, najwyżej bez wersalików nacisku) · **ZMIEŃ** · **USUŃ** · **LINT** (pilnuje ESLint/bramka — znika z tekstu,
test pilnuje, że nie wraca) · **SCAL** (treść przechodzi do wskazanego wiersza) · **DODAJ**.

## Porcja 1 — §1–§4

### §1 Rozmiar plików i funkcji

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 5 | Plik > 300 linii = refaktoruj | LINT | `max-lines` 360. Dziś tekst 300 vs bramka 360 = dwa progi (PA-26 e, ust. 1). Jedna linia nagłówka pliku mówi, które progi trzyma ESLint (pkt N1 niżej). |
| 6 | Funkcja > 50 linii; jeden poziom abstrakcji | LINT + USUŃ | `max-lines-per-function` 60; „jeden poziom abstrakcji” = duplikat L34 (jedna odpowiedzialność). |
| 7 | Funkcja > 6 argumentów = obiekt | ZOSTAW | „Funkcja z więcej niż 6 argumentami dostaje obiekt opcji.” (alternatywa: `max-params` warn w ESLint — zmiana konfiguracji P6, nie rekomenduję w P12). |
| 8 | Nesting > 2 = early return | ZMIEŃ | „Przy zagnieżdżeniu głębszym niż 2 poziomy wychodzisz wcześniej (early return).” Cel pozytywny (A4). Duplikat L98 znika. |
| 9 | Klasa > 1 odpowiedzialność = podziel | SCAL → L34 | Ta sama reguła w L34 i L215. |

### §2 Testowanie

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 16 | NIGDY nie modyfikuj testów, żeby naprawić failing | ZMIEŃ | „Czerwony test naprawiasz w implementacji. Test zmieniasz tylko wtedy, gdy zmienia się zamówione zachowanie — i nazywasz to w raporcie albo commicie.” Bez wersalików (PA-26 b); zgodne z §1 planu („test przypinający zmieniane zachowanie zmieniany jawnie”). Duplikat L66 znika. |
| 17 | NIGDY nie usuwaj testów, chyba że usuwasz funkcjonalność | ZMIEŃ (wyjątek A1) | „Test usuwasz razem z funkcjonalnością, którą sprawdza. Jedyny inny przypadek: zielony test niefalsyfikowalny, którego asercji nie da się przepisać — usuwasz go z wpisem w raporcie fazy. Czerwonego testu nie usuwasz.” (6a pkt 26, PLAN P12; bramka `testyUsuniete` widzi każde usunięcie.) |
| 18 | NIGDY nie osłabiaj asercji | ZOSTAW | „Asercji nie osłabiasz (`toBe(429)` → `toBeDefined()`): słabsza asercja przepuszcza błąd, który test miał łapać.” |
| 19 | NIGDY nie mockuj tego, co testujesz | ZOSTAW | „Atrapy tylko dla usług zewnętrznych; testowany moduł działa naprawdę, inaczej test sprawdza atrapę.” |
| 20 | Każdy test MUSI mieć ≥ 1 asercję | LINT + DODAJ | `vitest/expect-expect` łapie brak asercji. W miejsce: **pytanie „undefined”** — „Zanim zostawisz test, zapytaj, czy przeszedłby, gdyby każda importowana funkcja zwracała `undefined`. Jeśli tak — jedno konkretne wejście i dosłowny wynik albo obserwowalny skutek.” (A1, ust. 20.) |
| 21 | Nowa funkcja = happy path + error case | ZOSTAW | „Każda nowa funkcja publiczna ma test ścieżki poprawnej i test błędu.” (wchłania L109) |
| 22 | Uruchom testy PRZED „gotowe” | USUŃ | Duplikat L92 (PA-26 d); jedna wersja zostaje w §6. |
| 23 | Bez pełnych datasetów, fixtures w `tests/fixtures/` | ZOSTAW | bez zmian treści. |
| 24 | Arrange-Act-Assert | ZOSTAW | bez zmian. |
| 25 | Testuj ZACHOWANIE, nie implementację | ZMIEŃ | „Testujesz zachowanie widoczne z zewnątrz (wynik, DOM, zapis w bazie), nie stan wewnętrzny; komponent — przez Testing Library, tak jak używa go użytkownik.” (ust. 20) |
| 26 | Testy WERTYKALNIE (tracer bullets) | ZOSTAW | Treść bez „NIGDY” wersalikami; powód zostaje. |
| 27 | Nie refaktoruj na RED | ZOSTAW | bez zmian. |
| — | (ust. 21 Vitest Browser Mode) | NIE DODAJĘ | Szablon nie konfiguruje Browser Mode; temat dla P14 (E2E). |

### §3 Organizacja kodu

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 34 | Jedna odpowiedzialność per moduł | ZOSTAW (+L9, L215) | „Jedna odpowiedzialność na moduł, klasę i funkcję; plik komponentu nie zawiera logiki biznesowej.” |
| 35 | Kolokacja testów | ZOSTAW | bez zmian. |
| 36 | Wyciągaj shared logic zamiast duplikować | ZMIEŃ (+L37, L177) | **Rozstrzygnięcie sprzeczności §3/§11 (ETAP2, 6a pkt 5):** „Wspólny moduł wydzielasz przy trzecim użyciu tej samej logiki; przy dwóch prosta duplikacja jest lepsza niż abstrakcja. Wyjątek: stała albo kontrakt (schemat, typ, próg) w dwóch miejscach — od razu jedno źródło, bo kopie rozjeżdżają się po cichu.” (wyjątek = klasy `duplikacja`, `kontrakt-wspolny`; L-CQ-2 u code-quality) |
| 37 | Abstrakcja dopiero przy 2+ użyciach | SCAL → L36 | Próg 2 przeczył L177; jeden próg w L36. |
| 38 | Bez konfiguracji dla stałych wartości | ZOSTAW | bez zmian. |
| 39 | Importy grouped, sorted | LINT | `import-x/order`. Duplikat L134 znika. |
| 40 | Jeden eksport per plik dla głównych modułów | USUŃ | „Główny moduł” niesprawdzalny; bot cytuje regułę bez defektu (klasa `konwencja-kodu`). Martwe eksporty łapie knip. |

### §4 Error handling

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 47 | NIGDY nie łap i nie ignoruj (empty catch) | LINT + ZMIEŃ (+L48) | Pusty catch łapie `no-empty`. Zostaje część semantyczna (klasa `polkniety-blad`): „Każdy catch zostawia ślad dla operatora (log z kodem błędu i przyczyną) albo rzuca dalej.” |
| 48 | NIGDY pustego `catch {}` | SCAL → L47 | duplikat L47. |
| 49 | Typed errors, nie stringi | ZMIEŃ | „Rzucasz typowany błąd (klasa z kodem), nie string; w Hono — `HTTPException` i jedna obsługa w `app.onError`.” (ust. 17) |
| 50 | Fail fast | ZOSTAW | bez zmian. |
| 51 | Nie over-catchuj | ZOSTAW | „Łapiesz konkretne typy błędów, nie ogólny `Error`.” |
| 52 | Format odpowiedzi API `{ data, error }` | ZOSTAW | bez zmian (`app.onError` zwraca ten format). |
| 53 | Structured logging, nie `console.log` | ZMIEŃ | `no-console` przejmuje zakaz; zostaje: „Logujesz strukturalnie (JSON z kodem błędu), np. pino.” |
| 54 | Nie suppressuj — finding zawsze wymaga naprawy | USUŃ | Przeczy P8: P3 trafia do known-issues, fix naprawia P1/P2. Część o „racjonalizacji” = L70. |

## Porcja 2 — §5–§8

### §5 Anty-patterny specyficzne dla AI

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 57 | nagłówek „Anty-patterny specyficzne dla AI” | ZMIEŃ | „Zakres zmian i bramki” — sekcja mówi, co robić, nie opisuje modelu (PA-26 a). |
| 61 | Sprawdź package.json PRZED użyciem | SCAL → L130 | duplikat §8. |
| 62 | Nie dodawaj nieużywanych importów | LINT | `no-unused-vars` + knip. |
| 63 | Bez defensive code | ZMIEŃ | „Obsługujesz scenariusze, które mogą wystąpić w tym kodzie; dla niemożliwych nie dodajesz gałęzi, konfiguracji ani abstrakcji.” (A4) |
| 64 | Refaktoryzacja 160 plików — PYTAJ | ZMIEŃ | „Zmianę szerszą niż zadanie (refaktor wielu plików) najpierw uzgadniasz z operatorem; w workflowie zgłaszasz ją jako następny krok.” |
| 65 | Nie modyfikuj własnych reguł / scripts / hooks | ZMIEŃ (+L67) | PA-26 c: koliduje z compoundem (pisze wiedzę projektu) i z utrzymaniem szablonu. „Konfiguracji bramek (ESLint, tsconfig, progi, hooki) nie luzujesz, żeby zmiana przeszła — błąd naprawiasz w kodzie; regułę zmieniasz tylko na prośbę operatora.” |
| 66 | Test failuje — napraw KOD | USUŃ | duplikat L16. |
| 67 | Linter failuje — napraw KOD | SCAL → L65 | |
| 68 | Nie obchodź blokad zmianą narzędzia | ZOSTAW | „Zablokowane narzędzie albo hook to sygnał do zatrzymania i zgłoszenia, nie do obejścia innym narzędziem (sed, python -c).” |
| 69 | Niejasne instrukcje — PYTAJ | ZOSTAW | „Przy niejasnej instrukcji pytasz; w workflowie zwracasz status `blocked` z pytaniem.” |
| 70 | Nie dismissuj findings jako pre-existing | ZMIEŃ | „Defekt w kodzie sprzed zmiany nie jest powodem do pominięcia — naprawiasz albo zgłaszasz z miejscem (plik:linia).” (zgodne z P3 → known-issues) |
| 72–85 | Tabela „10 anty-patternów AI” z % | USUŃ | PA-26 a (opis skłonności modelu, dubluje L61–70), ETAP2 (procenty bez źródła). |

### §6 Self-check / Code review

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 92 | ZAWSZE typecheck, test, lint | ZMIEŃ | „Zanim zgłosisz koniec: typecheck, testy i lint dla zmienionych plików; pełny zestaw robi domknięcie fazy.” Jedna wersja zamiast dwóch (PA-26 d); zawężenie = D7-1. Alternatywa PA-26 d: usunąć całkiem. |
| 93 | Przed commitem: secrets, .env, console.log, TODO/FIXME | ZMIEŃ | „Commit nie zawiera plików `.env` ani nowych TODO/FIXME.” Sekrety = §9, `console` = ESLint. |
| 94 | Każdy nowy plik ma test | USUŃ | L21 (funkcja publiczna) jest precyzyjniejsza; plik typów/konfiguracji testu nie potrzebuje. |
| 95 | Nie duplikuj — grep codebase | ZOSTAW | „Przed napisaniem funkcji szukasz istniejącej (grep).” |
| 96 | Dead code | LINT | knip + `no-unused-vars`. |
| 97 | Magic numbers → named constants | ZOSTAW | bez zmian. |
| 98 | Deep nesting max 2 | USUŃ | duplikat L8. |
| 99 | Nie committuj bez prośby usera | ZMIEŃ | „Commit robisz, gdy prosi o to operator albo polecenie workflowu.” (dziś przeczy poleceniom domknięcia i fixa) |
| 101–109 | Quality gate (7 punktów) | USUŃ | 1–3 = bramki domknięcia, 4 i 6 = ESLint, 5 = §9, 7 = L21. |

### §7 Nazewnictwo

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 116–121 | is/has, handle, UPPER_SNAKE, PascalCase, camelCase, kebab-case | ZOSTAW | bez zmian (konwencja, bez lint `naming-convention` — dużo szumu). |
| 122 | Nazwy CO, nie JAK | ZOSTAW (+L181) | „Nazwa mówi, co robi (`getUserById`); test: rozumiesz ją w 5 sekund.” |
| 123 | Bez akronimów | ZOSTAW | bez zmian. |

### §8 Zależności i importy

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 130 | NIGDY nie zakładaj, że biblioteka jest dostępna | ZOSTAW (+L61) | „Przed użyciem biblioteki sprawdzasz manifest (package.json, requirements.txt, go.mod).” |
| 131 | NIGDY nie instaluj bez poinformowania | ZOSTAW | „Nową zależność zgłaszasz operatorowi (w workflowie: w odchyleniach).” |
| 132 | Preferuj istniejące biblioteki | ZOSTAW | |
| 133 | Nie mieszaj package managerów | ZOSTAW | |
| 134 | Importy grouped | USUŃ | duplikat L39 (LINT). |
| 135 | Monorepo — przez shared layer | ZOSTAW | |
| 136 | Pinuj exact versions | ZOSTAW | |

## Porcja 3 — §9–§14, dodatki, sposób ładowania

### §9 Bezpieczeństwo

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 143 | NIGDY nie committuj secrets | ZOSTAW | „Sekrety tylko w zmiennych środowiska poza repo.” |
| 144 | NIGDY nie loguj secrets / PII | ZMIEŃ | „Sekretów i danych osobowych nie logujesz — także do Sentry: redakcja przed wysłaniem.” (klasa `pii-i-sekrety`, L-SEC-2) |
| 145 | SQL — parametryzacja | ZOSTAW | |
| 146 | Bez dynamicznego wykonania kodu z inputu | ZOSTAW | |
| 147 | NIGDY nie deserializuj niezaufanych danych | SCAL → L149 | W TS „deserializacja” = `JSON.parse` + schemat; jedna reguła granicy. |
| 148 | `user_metadata` / rola w `app_metadata` | ZMIEŃ | „Rola z tabeli ról w bazie (Custom Access Token Auth Hook wstawia ją do JWT); nie z `user_metadata` — użytkownik zmienia je przez `updateUser` — ani z top-level claimu `role`.” (ust. 15: przewodnik RBAC Supabase nie wymienia `app_metadata`) |
| 149 | Waliduj KAŻDY input na granicy API | ZMIEŃ (+L147, L168) | „Dane z zewnątrz (ciało, nagłówki, pliki, JSON) parsujesz schematem Zod przed użyciem, kopertę — `z.strictObject`. W Hono — `zValidator` jako middleware; bez pasującego Content-Type ciało przychodzi jako `{}`, więc test na brak nagłówka.” (ust. 16, L-SEC-3) |
| 150 | Migracje / ETL / seedy walidują dane | ZOSTAW | bez zmian (Twoja reguła z incydentu). |
| 151 | Minimum privileges | ZOSTAW | |
| 152 | `rm -rf` tylko za zgodą | ZOSTAW | |
| 153 | Bez zmian na produkcji bezpośrednio | ZOSTAW | |
| 154 | Rate limiting na KAŻDYM public endpoint | ZMIEŃ | „Każdy publiczny endpoint ma limit częstości, limit rozmiaru ciała i limit rozmiaru strony; operacje wrażliwe (logowanie, reset hasła, wysyłka) — osobny, niższy limit.” (ust. 19, OWASP API4:2023) |
| — | RLS (ust. 12, 13) | DODAJ | „Polityki RLS: `(select auth.uid())` zamiast `auth.uid()` (liczone raz na zapytanie), indeks na kolumnie filtra polityki, każda polityka z `TO <rola>`; funkcja `security definer` nigdy w schemacie wystawionym przez API.” |

### §10 Type safety

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 161 | NIGDY `any` | LINT | `no-explicit-any` (error). |
| 162 | NIGDY `as` poza DOM | ZMIEŃ (+L167) | „Zamiast `as` — `satisfies` albo type guard; `as` tylko przy zawężaniu DOM i `as const`.” (ust. 10) |
| 163 | NIGDY `!` | LINT | `no-non-null-assertion` (warn → lista code-quality z dossier). |
| 164 | Discriminated unions zamiast flag | ZOSTAW | |
| 165 | Explicit return types w publicznych | ZOSTAW | |
| 166 | `strict: true` | ZMIEŃ | „tsconfig: `strict` i `verbatimModuleSyntax`; w nowym projekcie także `erasableSyntaxOnly` (bez `enum`, `namespace` z kodem, parameter properties).” (ust. 8, 9; w starszym projekcie `erasableSyntaxOnly` = osobna migracja enumów) |
| 167 | Generics > type assertions | SCAL → L162 | |
| 168 | Zod/io-ts na granicach | SCAL → L149 | duplikat. |
| — | `using` / `await using` (ust. 11) | NIE DODAJĘ | Wsparcie `Symbol.dispose` w Edge Functions (Deno) i w przeglądarkach do sprawdzenia; bez dowodu, że działa w stacku szablonu. |

### §11 Filozofia review kodu — cała sekcja

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 175–176 | Istniejący surowo / nowy pragmatycznie | USUŃ | Zasada reviewera — jest w pliku code-quality (P11 S2). |
| 177 | Duplication > Complexity | SCAL → L36 | jeden próg. |
| 178–180 | Nowy moduł zamiast komplikowania istniejącego | ZOSTAW jako jedna linia w §3 | „Nową logikę wydzielasz do nowego modułu zamiast rozbudowywać istniejący, gdy rozbudowa utrudnia jego zrozumienie.” |
| 181 | 5-sekundowa reguła nazw | SCAL → L122 | |

### §12 Performance

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 188 | O(n²) wymaga komentarza | ZOSTAW | |
| 189 | N+1 → batch/join | ZOSTAW | |
| 190 | Subset: pagination, limit, kolumny | ZOSTAW | |
| 191 | Nowa dependency — bundlephobia | ZMIEŃ | „Nowa zależność w kodzie klienta: sprawdzasz jej rozmiar przed dodaniem; budżet paczki pilnuje size-limit w domknięciu.” |
| 192 | `React.lazy` dla > 50KB | ZOSTAW | |
| 193 | Nie optymalizuj przedwcześnie, MIERZ | ZOSTAW | bez wersalików. |

### §13 Async i race conditions

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 200 | useEffect z async = ZAWSZE AbortController | ZMIEŃ | **Sprzeczne z react.dev (ust. 7), dołożony `AbortSignal.any` był regresją fixa (ETAP2 §0 pkt 6).** „Efekt z async unieważnia wynik w cleanupie (flaga `ignore`); dane przy montowaniu pobierasz przez TanStack Query albo mechanizm frameworka, nie ręcznym fetchem w efekcie.” |
| 201 | Timery — cleanup w useEffect | ZOSTAW | |
| 202 | > 1 boolean → state machine | ZMIEŃ | „Stan ładowania z więcej niż jedną flagą — unia dyskryminowana; formularz — `useActionState` / `useOptimistic` zamiast ręcznych flag.” (ust. 4) |
| 203 | `Promise.allSettled` | ZOSTAW | |
| 204 | `Promise.finally()` | ZOSTAW | |
| 205 | rAF — cancel flag | ZOSTAW | |
| 206 | Operacje wykluczające się — blokada | ZOSTAW | |
| — | Limit czasu (ust. 18) | DODAJ | „Każde wywołanie sieciowe ma limit czasu (`AbortSignal.timeout`).” (klasa `limit-czasu-i-ponowien`) |
| — | React Compiler (ust. 6) | DODAJ | „Przy włączonym React Compilerze nie dodajesz ręcznie `useMemo` / `useCallback` — kompilator memoizuje.” (zgodne z PA-03) |

### §14 Architektura

| L | Dziś (skrót) | Propozycja | Nowe brzmienie / powód |
|---|---|---|---|
| 213 | Zero circular dependencies | LINT | `import-x/no-cycle`. |
| 214 | Layer boundaries | ZMIEŃ | „Warstwy: strona → komponent → hook → serwis → klient bazy; komponent nie woła bazy (import klienta Supabase w warstwie prezentacji blokuje ESLint).” |
| 215 | SRP plików | SCAL → L34 | |
| 216 | Kontrakty API stabilne | ZOSTAW | |
| 217 | Nowa zależność między modułami — coupling? | ZOSTAW | |

### Nagłówek i forma pliku

| # | Propozycja | Treść / powód |
|---|---|---|
| N1 | DODAJ linię nagłówka | „Rozmiar plików i funkcji, `any`, `!`, puste catch, `console`, kolejność importów, cykle, pływające promise'y, nieużywany kod i asercje w testach pilnuje ESLint i bramki domknięcia; błąd naprawiasz w kodzie.” — builder wie, że próg istnieje, bez powtarzania progów. |
| N2 | ZMIEŃ formę | Bez podnagłówków „### Reguły”; NIGDY/ZAWSZE/MUSI małymi literami tam, gdzie zostają (PA-26 b); przy regule bez oczywistego powodu — powód w tym samym zdaniu (A4). |
| N3 | Test | `__tests__`: reguły oznaczone LINT nie występują w tekście (frazy: „300 linii”, „50 linii”, „pusty catch”, „console.log”, „circular”, `any`-zakaz, …). |

### Sposób ładowania (decyzja po treści)

Dziś plik siedzi w `.claude/rules/` bez `paths:` → ładuje się każdemu agentowi i każdej sesji (10,5k zn × 25 agentów smoke'a). Plan P12: „warstwa
referencyjna po typie pliku, nie eager”. Opcje — do wyboru po decyzjach treści (znany będzie rozmiar):
- **A (rekomendacja wstępna):** plik przenoszę poza `.claude/rules/`, sekcje oznaczone typem pliku (kod TS, React, SQL/migracje, testy, Edge/Hono);
  orkiestrator dokleja builderowi sekcje pasujące do plików IU (ten sam mechanizm co wycinek wiedzy), reviewerzy mają swoje listy po temacie (P11),
  sesja główna projektu dostaje jedną linię w CLAUDE.md („reguły kodu: `<ścieżka>`, czytaj przy pisaniu kodu”). Zysk: ~5k tok startu u każdego agenta.
- **B:** `paths:` we frontmatterze — mini-run (b) 0/3 (ładuje się tylko przy Read/Edit, buildery czytają Bashem), więc ryzyko, że builder reguł nie dostanie.
- **C:** zostaje eager, tylko krótszy plik.

## Odbiorcy do przepięcia (po decyzjach treści, ten sam commit co plik)

`.claude/workflows/dev-autopilot-wf.js:910` („coding-rules §2” → po temacie), `.claude/skills/dev-pr/SKILL.md`, `.claude/skills/coderabbit-setup/SKILL.md`
+ `templates/coderabbit-base.yaml` (stała ścieżki z P5), `.claude/skills/dev-docs/SKILL.md`, `.claude/skills/security/resources/owasp-react-supabase.md`,
`.claude/scripts/bramki/testy-usuniete.mjs`, `.claude/templates/bramki/eslint.config.szablon.ts` (komentarz „360/60 = coding-rules 300/50 + 20%”), README.

## Decyzje (2026-10-06)

**Operator przekazał ocenę Claude'owi** („nie mam wiedzy, żeby to ocenić — chciałbym, żebyś ty to ocenił”). Przed zapisem tabelę sprawdził
niezależny agent (Opus, general-purpose; źródła + konfiguracja ESLint + projekt oferty-online): 22 uwagi, wszystkie przyjęte poza zaznaczonymi.
Wynik: commit `6da298e` (plik + odbiorcy + test `coding-rules.test.mjs`). Tabela wyżej = propozycja; poniżej różnice względem niej.

1. **LINT nie usuwa reguły z tekstu** (uwaga 1): oferty-online nie ma `eslint.config.*` ani narzędzi bramek — bramki dają `brak`, nie porażkę,
   a `/dev-pr` i sesja główna nie przechodzą przez bramki. Reguły mechaniczne zostają jednym blokiem „Pilnuje ESLint i bramki domknięcia” z progami
   360/60 = konfiguracja. Test zamiast „nie występują w tekście”: progi w bloku = progi ESLint, poza blokiem żadnego progu linii (koniec 300 vs 360).
2. **`!`** (uwaga 2): reguła ESLint ma poziom `warn` → zostaje zdaniem w Type safety („zamiast `!` — zawężenie albo early return”).
3. **Pusty catch** (uwaga 3): blok ESLint mówi „pustego bloku `catch`”; zasada śladu obejmuje też `.catch(() => …)` (no-empty go nie łapie).
4. **Zakres plików** (uwaga 4): blok mówi „plik TS/TSX”.
5. **Wyłączenia w linii** (uwagi 5, 16, 19): Zakres zmian i bramki — bez `eslint-disable` / `@ts-expect-error` w linii; „regułę zmienia operator;
   wiedzę projektu zapisuje compound według swojego skilla” (koniec kolizji PA-26 c).
6. **Warstwy** (uwaga 6): bez nawiasu o ESLint — globy `PREZENTACJA` nie obejmują `apps/*/src/features/<x>/*.tsx` w oferty (do odczytu niżej).
7. **Efekt z async** (uwaga 7): „abort albo flaga `ignore`” (react.dev dopuszcza oba); biblioteka cache / loader — tylko gdy projekt ją ma.
8. **Limit czasu** (uwaga 8): w efekcie z abortem — limit + flaga `ignore`, bez łączenia sygnałów (regresja `AbortSignal.any`); supabase-js przez
   opakowany `fetch`.
9. **Rola** (uwaga 9): `app_metadata` ustawiane po stronie serwera zostaje jako dopuszczalne (strona RLS Supabase) — zgodne ze skillem security,
   generatorem bota i README; tabela ról przez funkcję w polityce albo claim z hooka.
10. **RLS i `security definer`** (uwaga 10): zamiast zakazu — `set search_path = ''`, EXECUTE odebrane od `public`/`anon`, kontrola w ciele
    (oferty ma >15 takich funkcji celowo); `(select auth.jwt())` obok `auth.uid()`.
11. **Granica API** (uwagi 11, 12): pełny zakres wejść (query, parametry, cookies, odpowiedzi usług); walidator Hono tylko jeśli projekt go ma,
    z hookiem zwracającym kopertę; `app.onError` mapuje `HTTPException` na kopertę, trasy MCP/JSON-RPC z własnym formatem.
12. **Compiler** (uwaga 13): warunek = `babel-plugin-react-compiler` w projekcie, wyjątek: stabilna zależność efektu. Bezwarunkowe zakazy memo
    w builderach i `tailwind-react-guidelines/SKILL.md:42` — do wyrównania w S2/S3 (pliki przepisywane).
13. **tsconfig** (uwaga 14): jedna linia zostaje; sprawdzenie flag w doctor — poza P12.
14. **Poziom abstrakcji** (uwaga 15): dopisany do „Rozmiar i struktura”.
15. **Usunięcie testu** (uwaga 17): komentarz `testy-usuniete.mjs` mówi o wyjątku; reguła nie twierdzi, że bramka „widzi każde usunięcie”.
16. **`using`** (uwaga 21): nie dodane — brak potrzeby w stacku, nie brak wsparcia.

**Sposób ładowania — wariant B z jawnym odczytem** (uwaga 22 pokazała luki A: sesja główna, fix, planner, `.coderabbit.yaml` i CLAUDE.md
istniejących projektów nie aktualizowane przez sync): plik zostaje w `.claude/rules/coding-rules.md` (ścieżka bota, sync i telemetria bez zmian)
z `paths:` na kod i SQL. Kanał `paths:` działa tylko przy Read/Edit (pomiar 1; mini-run (b) 0/3 — buildery czytają Bashem), więc odbiorcy, którzy
reguł potrzebują, czytają plik jawnie: fix autopilota i naprawy `/dev-pr` (ten commit), buildery (S2/S3, jedno polecenie w pliku roli).
Agenci mechaniczni, orkiestracyjni, scribe, compound i sceptycy przestają płacić ~5k tok na starcie. **Kryterium w smoke'u P12:**
`agent.kontekst.rules_zn` = 0 u ról bez kodu, > 0 u builderów i fixa; podwójny odczyt (Read + `paths:`) widoczny jako `rules_zn` ≈ 2 × rozmiar pliku
→ wtedy jedno z dwóch źródeł wypada. Odwrót: usunąć frontmatter (jedna linia, eager jak dziś).

**Do odczytu poza P12 (ESLint szablonu, P6/P16):** globy `PREZENTACJA` nie obejmują układu `apps/*/src/features/<x>/*.tsx` (oferty importuje klienta
Supabase w widokach); `no-non-null-assertion` tylko `warn`; `.catch(() => {})` przechodzi przez `no-empty`; reguły rozmiaru i `no-console` tylko
w `**/*.{ts,tsx}`.

---
name: dev-docs
description: "Transformacja planu technicznego z docs/plans/ w strukturę zadania dla autopilota: branch feature/<nazwa> + docs/active/<nazwa>/ (plan faz, kontekst, zadania z checkboxami) + bramka gotowości i handoff na dev-autopilot-wf."
argument-hint: "[ścieżka do planu z docs/plans/ lub nazwa zadania] — tworzy docs/active/[nazwa]/"
---

# dev-docs — z planu technicznego do zadania dla autopilota

**Uwaga: Aktualny rok to 2026.** Używaj tego przy datowaniu plików.

`/dev-plan` zdecydował **JAK** budować (Implementation Units pogrupowane w fazy). Ten skill **nie planuje ponownie** — jest deterministyczną transformacją planu w format, który czytają `dev-autopilot-wf`, `dev-docs-execute-wf` i `dev-docs-review-wf`. Zero nowej treści merytorycznej: żadnych własnych ryzyk, szacunków, „analizy obecnego stanu" ani dodatkowych zadań. Jeśli czegoś brakuje w planie, to brak jest w planie — wróć do `/dev-plan`, nie dopisuj tego tutaj.

Input: `$ARGUMENTS` — ścieżka do planu technicznego (`docs/plans/YYYY-MM-DD-NNN-<type>-<slug>-plan.md`) lub nazwa zadania. Gdy pusty — weź najnowszy plan ze `status: active` w `docs/plans/`, który nie ma jeszcze folderu w `docs/active/` ani `docs/completed/`; jeśli kandydatów jest kilka — zapytaj (`AskUserQuestion`).

## Kontrakt wyjściowy (czytają go workflowy — nie zmieniaj formatu)

| Element | Format | Kto czyta |
|---|---|---|
| Fazy | `## Faza N — <nazwa>` w `*-zadania.md`, lista `(numer, nazwa)` w `*-plan.md`; numeracja od 1, bez luk, **1:1 z planem technicznym** | autopilot (bootstrap parse), execute-wf, review-wf (`review-faza-N.md`) |
| IU w fazie | `### IU-K: <nazwa> (<Delegate to>)` | execute-wf planner (`agentType` z `Delegate to:`) |
| Checkbox implementacyjny | `- [ ] <co>` — z `Pliki:` i `Podejście:` IU (w tym `Stwórz (e2e seed):` — autorstwo seeda to kod buildera) | builder implementuje; domknięcie execute-wf odznacza; liczy się do `execute=done` |
| Checkbox testowy `[Unit]` | `- [ ] Test: [Unit] <scenariusz>` — **liczy się do `execute=done`**: builder pisze test razem z kodem, domknięcie execute-wf odznacza | execute-wf, autopilot (bootstrap) |
| Checkbox testowy `[E2E]` | `- [ ] Test: [E2E] \`<flow>\`[ (seed: e2e/seeds/<x>-seed.sql)] — <scenariusz> → <oczekiwany stan>` — **jedyna nośna linia scenariusza** (identyfikator flow i seed w tej samej linii: db-sync dobiera po nich seedy, tester i scribe dopasowują po nazwie flow); marker dosłownie z planu; wypada z liczenia `execute=done` wyłącznie przez marker | odznacza **WYŁĄCZNIE** scribe review-wf po PASS testera (bookkeeping) albo fix autopilota po PASS re-runu E2E (agent-browser); execute NIE rusza; autopilot (`grep '\[E2E\]'` = czy zadanie wymaga E2E, completion-gate) |
| Checkbox weryfikacyjny | `- [ ] Weryfikacja: <automatyzowalne kryterium>` (CLI/grep). Wariant `Weryfikacja: [E2E] \`e2e/<runner>.sh\` — <stan>` **tylko** dla runnera/flow, który NIE jest scenariuszem z `Test: [E2E]` (np. `run-all.sh`) — dla flow scenariusza nie emituj drugiej linii `[E2E]`: każda linia `[E2E]` = osobny przebieg w licznikach precheck/tester/gate | review-wf odznacza po PASS; execute NIE rusza |
| Operator | `## Operator checklist faza N` — jedna sekcja per faza, na końcu fazy; zawiera `Operator checklist` z IU oraz scenariusze `[Manual]` | autopilot i execute-wf POMIJAJĄ; review-wf dopisuje findingi OPERATOR; `dev-docs-complete` zbiera do smoke'u operatora |
| Findingi review | `## Do poprawy po review fazy N` — **nie twórz**; sekcję zakłada review-wf | autopilot (fix) |

**Co liczy się do `execute=done` (dokładna skip-lista parserów — bootstrap autopilota i planner execute-wf):** do uznania fazy za wykonaną NIE liczą się wyłącznie checkboxy z prefiksem `Weryfikacja:` lub `Operator:`, checkboxy oznaczone `[E2E]` lub `[Manual]` (niezależnie od prefiksu) oraz wszystkie checkboxy w sekcjach `## Operator checklist faza N` i `## Do poprawy po review fazy N`. **Każdy inny** niezaznaczony `- [ ]` — w tym `Test: [Unit]` — trzyma fazę w `execute=pending`. `Test: [E2E]` i `Weryfikacja: [E2E]` odznacza tylko realny przebieg E2E (review/fix) — nigdy domknięcie execute. Checkbox operatora wpisany jako zwykły `- [ ]` w bloku IU to bug: faza nigdy nie będzie `done` z parse'u md.

**Twarde reguły formatu linii** (parsery grepują `^- \[ \]` — wcięty checkbox jest dla nich niewidoczny: precheck E2E, completion-gate, packager review, smoke operatora):
- Każdy checkbox zaczyna się w **kolumnie 0**: bez wcięcia, bez zagnieżdżania pod innym bulletem/checkboxem. Dozwolona jest wcięta **kontynuacja treści** w kolejnej linii (bez `- [ ]`).
- Scenariusz `[E2E]` to osobny płaski checkbox `- [ ] Test: [E2E] …` — nigdy „nagłówek" z pod-checkboxami (wzorzec, który zepsuł parse w szablonie mobile).
- Checkbox implementacyjny **nie zawiera** `[E2E]`, `[Manual]` ani prefiksów `Test:`/`Weryfikacja:`/`Operator:` — inaczej builder i bootstrap go pominą, a faza będzie `done` bez wytworzonego pliku. Autorstwo seeda zapisuj 1:1 z `Pliki:` planu: `- [ ] Stwórz (e2e seed): e2e/seeds/<flow>-seed.sql`.
- Nie dopisuj emoji, statusów ani tekstu między `- [ ]`/`- [x]` a prefiksem.

## Instrukcje

### Faza 0: Git i nazwa zadania

1. **Nazwa zadania** = `<slug>` z nazwy pliku planu (część `<descriptive-name>` z `YYYY-MM-DD-NNN-<type>-<slug>-plan.md`), chyba że użytkownik podał inną. Kebab-case, bez daty.
2. **Stan repo:** `git status --short`. Rozróżnij dwie klasy pozycji:
   - **(a) Artefakty planowania** — wyłącznie pod `docs/plans/`, `docs/operator/`, `docs/brainstorms/` (nowe `??` lub zmodyfikowane `M`). To **oczekiwany** stan po `/dev-plan` (plan, `-figma/`, przygotowanie dla operatora) — nie zatrzymuj się. Zapamiętaj listę ścieżek: trafią do commitu inicjalnego w Fazie 4. `git checkout -b` przenosi je na nowy branch, więc plan wyląduje na `feature/<nazwa>`, nie na `main`.
   - **(b) Dowolna inna pozycja** (kod, `e2e/`, `.env*`, `package.json`, inne docs) → **STOP** i zapytaj: zacommitować TYLKO te pliki na bieżącym branchu / schować TYLKO te pliki (`git stash push -u -- <ścieżki z (b)>` — gołe `git stash` nie chowa plików nieśledzonych, a `-u` bez pathspec schowałoby też plan) / przerwać. Nigdy nie stashuj ani nie commituj na `main` ścieżek z klasy (a).
3. **Branch `feature/<nazwa>`:**
   - `git branch --show-current` — jeśli już na nim jesteś → zostań.
   - `git branch --list feature/<nazwa>` niepuste → `git checkout feature/<nazwa>` (nie `-b`; branch z poprzedniej próby/wznowienia).
   - W przeciwnym razie `git checkout -b feature/<nazwa>` z aktualnego brancha (upewnij się, że to `main`/`develop` — jeśli nie, zapytaj).
4. Jeśli `docs/active/<nazwa>/` **już istnieje** → to wznowienie, nie inicjalizacja: pokaż stan (`.autopilot-state.json`, odhaczone fazy) i zapytaj, czy zregenerować tylko brakujące pliki, czy przerwać. Nigdy nie nadpisuj `*-zadania.md` z postępem.

### Faza 1: Wczytaj źródła (bez interpretacji)

1. **Plan techniczny** (wymagany). Przeczytaj cały plik. Wyciągnij: frontmatter (`origin`, `design_md`, `figma_spec`, `figma_screens`, `operator_prep`), „Śledzenie wymagań", „Granice scope'u", „Kluczowe decyzje techniczne", „Otwarte pytania → Odroczone do implementacji", „Wymagania wstępne operatora", wszystkie `### Faza N — …` i IU pod nimi, „Wpływ systemowy", „Ryzyka i zależności".
   - **Brak planu technicznego** → STOP: „Nie ma planu technicznego dla tego zadania. Uruchom `/dev-plan` — `dev-docs-execute-wf` szuka Implementation Units w `docs/plans/` i bez nich planner fazy nie ma czego delegować builderom." Nie twórz zadania z samego opisu; jeśli użytkownik mimo to nalega, najpierw odpal `/dev-plan` w głębokości Lekkiej.
   - **Plan bez nagłówków `### Faza N`** (starszy format, płaska lista IU) → nie wymyślaj podziału w ciszy. Zaproponuj podział (1 faza dla ≤4 IU; inaczej wg zależności `Zależności:` IU) przez `AskUserQuestion` i po akceptacji **dopisz nagłówki faz do planu technicznego** (żeby plan i zadania były spójne), dopiero potem kontynuuj.
   - **Fazy oznaczone literami** (`### Faza A — …`, starsze plany) → przenumeruj na `1..N` w kolejności występowania i wpisz mapowanie (`A→1, B→2, …`) w tabeli faz `*-plan.md`; w zadaniach używaj wyłącznie numerów (parsery i `review-faza-N.md` nie znają liter).
2. **Dokument źródłowy z `origin:`** — trzy przypadki (spójne z `dev-plan` 0.2), żaden nie jest powodem STOP:
   - (a) ścieżka istniejącego pliku w repo, opcjonalnie z `#kotwicą` albo dopiskiem `(sekcja …)` → odetnij kotwicę/dopisek przed `Read`, przeczytaj wskazaną sekcję i sprawdź, że ID z „Śledzenie wymagań" planu występują w źródle. Nie kopiuj treści.
   - (b) dowolna inna wartość (Obsidian, „sesja /zroastuj-mnie …", opis, `null`) → NIE czytaj; w `Requirements doc:` wpisz wartość dosłownie z dopiskiem `(poza repo — ID wg „Śledzenie wymagań" planu)`; sprawdzenie ID ogranicz do spójności wewnątrz planu (każde ID ze „Śledzenie wymagań" ma pokrycie w co najmniej jednym IU).
   - (c) wygląda na ścieżkę w repo, ale plik nie istnieje → tylko ostrzeżenie w handoffie Fazy 5 („`origin` wskazuje nieistniejący plik — popraw frontmatter planu").
3. **Kontekst designerski:** pola `design_md`, `figma_spec`, `figma_screens` z frontmattera. Jeśli `figma_spec` ≠ null, a plik nie istnieje → STOP: „Plan deklaruje `figma_spec: <ścieżka>`, ale plik nie istnieje. Wróć do `/dev-plan` i zregeneruj kontekst designerski." To samo dla każdego PNG z `figma_screens`.
4. **`docs/CONCEPTS.md`** (jeśli istnieje) — używaj terminologii słownika w nazwach faz i checkboxów; nie przepisuj pojęć inaczej niż plan.
5. **`.claude/rules/learned-patterns.md`** (jeśli istnieje) — tylko do sprawdzenia scenariuszy `[E2E]` w Fazie 2 pkt 4.

### Faza 2: Transformacja planu w checklistę

Dla **każdej fazy** planu, w kolejności numerów:

1. **Nagłówek fazy** `## Faza N — <nazwa>` + linia `Zależy od: …` przepisana z planu (+ `Równolegle z:` gdy plan ją ma).
2. **Per IU** nagłówek `### IU-K: <nazwa> (<Delegate to>)` i pod nim, w tej kolejności:
   - checkboxy implementacyjne: jeden per pozycja z `Pliki:` (`Stwórz:` / `Modyfikuj:` / `Test (unit):` / `Stwórz (e2e seed):` — toleruj `Test (e2e): Scenariusz: …` ze starszych planów: jego treść przenieś do linii `Test: [E2E]`, nie emituj checkboxa implementacyjnego) z dopiskiem kluczowej decyzji z `Podejście:`, gdy bez niej checkbox byłby niejednoznaczny. Nie rozbijaj na micro-kroki; nie dodawaj pozycji, których nie ma w IU.
   - `- [ ] Test: [Unit] …` — każdy scenariusz `[Unit]` z `Scenariusze testowe:`.
   - `- [ ] Test: [E2E] \`<flow>\`[ (seed: e2e/seeds/<x>-seed.sql)] — <scenariusz> → <oczekiwany stan>` — **jedna linia per scenariusz `[E2E]`**: identyfikator flow z linii scenariusza planu, nazwa seeda gdy flow korzysta z danych (nowy z `Pliki:` IU lub istniejący), treść scenariusza (URL + kroki) i oczekiwany stan (jeśli plan ma kryterium `Weryfikacja: [E2E]` dla tego samego flow — **scal** jego oczekiwany stan do tej linii, nie emituj drugiego checkboxa `[E2E]`; każda linia `[E2E]` to osobny przebieg w licznikach precheck/tester/completion-gate). Jeśli plan ma scenariusz `[E2E]` bez identyfikatora flow — nadaj mu kebab-case identyfikator **w planie** (`docs/plans/`, commit w Fazie 4 to obejmuje), dopiero potem przepisz. `[Manual]` idzie do sekcji operatora fazy (pkt 5).
   - `- [ ] Weryfikacja: …` — każde kryterium CLI/grep z `Weryfikacja:`. `Weryfikacja: [E2E] \`e2e/<runner>\` — <stan>` emituj **tylko** dla runnera/flow, który nie jest żadnym scenariuszem z `Test: [E2E]` (np. `run-all.sh`).
3. **Zachowaj markery dosłownie**: `[Unit]`, `[E2E]`, `[Manual]`. Nie zmieniaj `[E2E]` na opisowe „test w przeglądarce" — autopilot grepuje marker.
4. **Bramka E2E per scenariusz `[E2E]`** (nie pomijaj — to najczęstsza cicha regresja):
   - prześledź flow krok po kroku i potwierdź, że **nie wymaga natywnego okna ani zewnętrznego systemu** (systemowy file picker/upload, popup OAuth providera, zewnętrzne okno płatności, captcha, odebranie e-maila) — agent-browser tego nie wykona i `[E2E]` cicho spadnie do Operatora. Jeśli wymaga: dane, które wpadłyby przez upload/zewnętrzny system → wstrzyknij seedem/service_role na bazie e2e i asertuj RENDER; logowanie zawsze e-mail+hasło kontem `E2E_TEST_EMAIL` (nigdy OAuth); krok nie do obejścia → `[Manual]` w sekcji operatora;
   - potwierdź kwestię seeda: seed `Stwórz (e2e seed):` w `Pliki:` wymagany TYLKO gdy scenariusz zakłada dane, których nie ma w stanie bazowym konta `E2E_TEST_EMAIL` (nowe rekordy/relacje/uprawnienia) i nie wskazano istniejącego seeda; gdy flow korzysta z istniejącego seeda — jego nazwa ma być w linii scenariusza `Test: [E2E] \`<flow>\` (seed: e2e/seeds/<x>-seed.sql) — …` (pkt 2), NIE w `Weryfikacja:` (db-sync czyta seed tylko z linii `[E2E]`, a druga linia `[E2E]` dla tego samego flow = osobny przebieg w licznikach). Autorstwo seeda NIE może wisieć pod checkboxem `Test:`/`Weryfikacja:` (to tylko uruchomienie przez testera) — inaczej nikt go nie napisze i E2E cicho spadnie do Operatora;
   - STOP i pytanie **tylko** gdy (a) scenariusz `[E2E]` nie ma identyfikatora flow ani kroków wykonywalnych z opisu, (b) flow wymaga natywnego okna / zewnętrznego systemu, albo (c) scenariusz zakłada dane spoza stanu bazowego konta E2E, a IU nie ma ani `Stwórz (e2e seed):`, ani nazwy istniejącego seeda (w linii scenariusza `[E2E]`). Przy (a) domyślna propozycja = „dopisz identyfikator flow i kroki do planu technicznego" (edytuj plan, potem kontynuuj); `[Manual]` tylko jako świadomy opt-out, nie równorzędna opcja. Nie naprawiaj w ciszy.
   - Nigdy nie kieruj E2E na bazę dev/prod — harness celuje w projekt z `.env.e2e`.
5. **Sekcja operatora fazy** `## Operator checklist faza N` (tylko gdy jest co wpisać): wszystkie pozycje `Operator checklist:` z IU tej fazy (z dopiskiem `(IU-K)`) oraz scenariusze `[Manual]` jako `- [ ] [Manual] … (IU-K)`. Jedna sekcja per faza, **po** wszystkich IU fazy, z dokładnie tym nagłówkiem.
6. **Nie twórz** sekcji `## Do poprawy po review fazy N` — zakłada ją review-wf.

Po przejściu wszystkich faz sprawdź bilans i format (popraw plik zanim przejdziesz dalej):
- liczba IU w zadaniach = liczba IU w planie;
- liczba linii `[E2E]` w zadaniach = liczba scenariuszy `[E2E]` w „Scenariusze testowe" planu (+ ewentualne runnery z `Weryfikacja: [E2E]` niebędące scenariuszem; bez tych świadomie przeniesionych do `[Manual]` w pkt 4, które wymieniasz w handoffie) — **jeden scenariusz = jedna linia**;
- `grep -cE '^\s+- \[[ x]\]' docs/active/<nazwa>/*-zadania.md` zwraca 0 (exit 1 = OK) — żadnych wciętych checkboxów;
- `grep -hE '^- \[ \].*\[E2E\]' docs/active/<nazwa>/*-zadania.md | grep -vcE 'Operator:|\[P[123]\]'` (ten sam grep co precheck autopilota i Faza 5) daje DOKŁADNIE liczbę z bilansu — rozjazd = wcięcie, marker w złym miejscu albo zdublowana linia dla jednego flow.

### Faza 3: Pliki w `docs/active/<nazwa>/`

Każdy plik zaczyna się od:

```markdown
Branch: `feature/<nazwa>`
Ostatnia aktualizacja: RRRR-MM-DD
```

**`<nazwa>-plan.md`** — mapa zadania (krótka; pełna treść jest w planie technicznym):
- `## Źródła` — `Plan techniczny:` (ścieżka, **wymagane** — execute-wf szuka tej referencji), `Requirements doc:` (wartość `origin:` dosłownie — także gdy poza repo, z dopiskiem z Fazy 1 pkt 2 — lub „brak", gdy `origin` pusty/null), `Przygotowanie dla operatora:` (z `operator_prep:` lub „brak").
- `## Cel` — 2–4 zdania z „Przegląd" planu.
- `## Zakres` — lista wymagań z „Śledzenie wymagań" (ID + jedno zdanie) i „Granice scope'u" przepisane.
- `## Fazy` — tabela `| Faza | Nazwa | IU | Zależy od | Delegaci |` — 1:1 z planem. To źródło listy faz dla autopilota.
- `## Kryteria akceptacji całości` — przepisane z „Metryki sukcesu"/„Śledzenie wymagań" planu + zdanie: „Każda faza: typecheck 0 błędów, testy PASS, review bez otwartych P1; każdy `[E2E]` uruchomiony (nie odhaczony ręcznie)".
- `## Blokery operatora per faza` — **tylko jeśli** bramka gotowości (Faza 5 pkt 2) znajdzie nieodhaczone pozycje `[blokuje: faza N]` dla N ≥ 2. Jedna linia na pozycję, z numerem fazy i wskaźnikiem do checklisty. Pozycje blokujące planowanie albo fazę 1 tutaj nie trafiają — one zatrzymują handoff.
- **Bez** własnych sekcji „Ryzyka", „Szacunek", „Analiza obecnego stanu" — jeśli plan ma „Ryzyka i zależności", wstaw jedno zdanie z linkiem do tej sekcji planu.

**`<nazwa>-kontekst.md`** — to, co buildery i reviewerzy dostają jako kontekst:
- `## Źródła` — jak wyżej.
- `## Plan techniczny` — **jedna linia** ze wskaźnikiem: `Kluczowe pliki, decyzje techniczne, odroczone
  pytania i wzorce do naśladowania: <ścieżka planu technicznego> (sekcje „Kluczowe decyzje techniczne",
  „Otwarte pytania", `Pliki:` i `Wzorce do naśladowania:` w blokach IU).`
  **Nie przepisuj tych sekcji.** Do 2026-09-03 plik kontekstu je kopiował i była to kopia utrzymywana
  ręcznie: w zbadanym zadaniu „Decyzje techniczne" miały 1 linię wspólną z planem na 23, a „Odroczone"
  0 na 10 — czyli przepisanie, nie kopia, i drugie źródło prawdy, które po dwóch fazach kłamało.
  Żaden workflow tych sekcji nie czytał; execute-wf bierze z tego pliku wyłącznie „Designerski kontekst"
  i „Dziennik", a planner sięga po decyzje wprost do planu technicznego.
- `## Designerski kontekst` — **dokładnie** ten blok (execute-wf kopiuje go do promptów builderów UI/fullstack):

  ```markdown
  ## Designerski kontekst

  - **DESIGN.md (projekt-wide):** [ścieżka z `design_md`, lub `null` jeśli brak/pure-data]
  - **SPEC.md (per-feature, pomiary z Figmy):** [ścieżka z `figma_spec`, lub `null`]
  - **Screeny referencyjne:** [lista z `figma_screens`, lub pusta]
    - `<name-1>`: `<ścieżka PNG>`

  > Te pliki są MANDATORY context dla subagentów buildujących UI. `dev-docs-execute` wstrzykuje je do promptu Agent tool. Tester `feature-tester-e2e` używa `figma_screens` do visual diff w przeglądarce.
  ```
  Jeśli wszystkie trzy pola są null/puste — pomiń sekcję.
- `## Wymagania wstępne operatora` — link do `operator_prep` + lista **nieodhaczonych** pozycji z markerem
  `[blokuje: …]` wraz z numerem blokowanej fazy, albo „Brak". To jedyne miejsce w `docs/active/`, gdzie
  operator widzi, co jeszcze wisi na nim w trakcie runu.
- `## Dziennik` — pusta lista; execute-wf dopisuje tu zmiany i decyzje per faza.

**`<nazwa>-zadania.md`** — wynik Fazy 2, poprzedzony nagłówkiem i linią `Źródła: plan techniczny <ścieżka>`.

### Faza 4: Commit inicjalny

- `git add docs/active/<nazwa>/` **+ dokładnie ścieżki klasy (a) zapamiętane w Fazie 0** (plan `docs/plans/<plik>-plan.md`, `docs/plans/<slug>-figma/`, operator checklist — **dokładna ścieżka z `operator_prep:`**, nie zgadywana nazwa: `/dev-prep` dziedziczy konwencję nazewniczą serii checklist projektu, więc plik bywa nazwany np. `docs/operator/e3-operator-checklist.md`, ew. zmieniony requirements doc z `origin:`) + plan techniczny, jeśli dopisałeś do niego fazy / poprawki E2E w Fazie 1–2. Dodawaj wyłącznie wylistowane ścieżki — bez blanket `git add docs/plans/` i bez `git add -A`.
- Commit: `docs: inicjalizacja planu dla <nazwa>` (plan + figma + przygotowanie operatora w tym samym commicie).

### Faza 5: Bramka gotowości i handoff na autopilot

Zanim zaproponujesz uruchomienie, sprawdź trzy rzeczy i **wypisz wynik każdej**:

1. **E2E:** `grep -hE '^- \[ \].*\[E2E\]' docs/active/<nazwa>/*-zadania.md | grep -vcE 'Operator:|\[P[123]\]'` (brak trafień = 0, grep kończy się kodem 1 — to nie błąd). Jeśli > 0, a `.env.e2e` nie istnieje → autopilot zatrzyma się na bramce setupu przed fazą 1. Napisz to wprost i podaj dwie drogi: setup wg `.claude/templates/e2e-env/README.md` (one-time, ~30 min) albo świadomy opt-out (`[E2E]` → `[Manual]` w zadaniach i w planie). Nie uruchamiaj autopilota „żeby zobaczyć".
2. **Przygotowanie dla operatora:** jeśli `operator_prep` ≠ null — `grep -nE '^- \[ \].*\[blokuje:' <dokładna ścieżka z `operator_prep`>` (brak trafień = 0, grep kończy się kodem 1 — to nie błąd). To **jedyna** rodzina markerów w pipeline: `[blokuje: planowanie]` i `[blokuje: faza N]`, obie pisane przez `/dev-prep` i `/dev-plan`. Rozdziel trafienia:
   - **`[blokuje: planowanie]`, `[blokuje: faza 1]` albo `[blokuje:` bez czytelnego numeru fazy → STOP.** Nie uruchamiaj `Workflow` — dokładnie tak samo jak przy brudnym drzewie. Wypisz te pozycje z numerami linii i podaj dwie drogi: odhaczyć je (`[ ]` → `[x]`) albo świadomie usunąć marker, jeśli pozycja przestała blokować. Autopilot ruszony mimo tego zaimplementuje fazę 1 bez kluczy/danych i dowiesz się o tym dopiero z review.
   - **`[blokuje: faza N]` dla N ≥ 2 → nie blokują startu**, ale muszą być widoczne dla operatora w trakcie runu. Wpisz je do `docs/active/<nazwa>/<nazwa>-plan.md` pod nagłówkiem `## Blokery operatora per faza` (utwórz sekcję, jeśli jej nie ma), po jednej linii: `- [ ] faza N — <treść pozycji 1:1> · <ścieżka checklisty>:<linia>`. Po dopisaniu **zacommituj jawnym pathspecem** (`git add docs/active/<nazwa>/<nazwa>-plan.md && git commit -m "docs(<nazwa>): blokery operatora per faza"`) — inaczej punkt 3 zobaczy brudne drzewo.
3. **Git:** aktualny branch = `feature/<nazwa>`, drzewo czyste po commicie (`git status --short` puste). Jeśli coś nadal jest brudne — wypisz co i nie kieruj do autopilota (jego bootstrap zatrzyma run na niezacommitowanych zmianach). Autopilot **nie** przełącza brancha sam.

## Format wyjściowy

```
✅ Zadanie "<nazwa>" gotowe dla autopilota

🔀 Branch: feature/<nazwa> (aktywny, drzewo czyste)
📄 Plan techniczny: docs/plans/<plik>.md
📁 docs/active/<nazwa>/
   - <nazwa>-plan.md       (N faz, K IU)
   - <nazwa>-kontekst.md   (designerski kontekst: tak/nie)
   - <nazwa>-zadania.md    (X checkboxów impl., Y Test:, Z Weryfikacja:, E [E2E], M [Manual]/operator)
📝 Commit: docs: inicjalizacja planu dla <nazwa> (docs/active/ + plan techniczny + przygotowanie operatora + figma)

🚦 Bramka gotowości:
   - E2E: <E scenariuszy; .env.e2e OK / BRAK → setup wg .claude/templates/e2e-env/README.md lub opt-out>
   - Przygotowanie dla operatora: <brak / ścieżka z `operator_prep`: P pozycji; blokujące start (`[blokuje: planowanie]` / `[blokuje: faza 1]`): B → STOP albo OK; odroczone do faz ≥2: K, wpisane do plan.md>
   - Git: OK

➡️ Następny krok (domyślny): uruchom autopilot w tej sesji:
   Workflow({ scriptPath: ".claude/workflows/dev-autopilot-wf.js", args: "docs/active/<nazwa>" })
   Po STOP bramki (E2E, fix FAIL, P1) i naprawie — świeży run z tymi samymi args, BEZ resumeFromRunId.
   Po awarii runu (crash) — resume: Workflow({ scriptPath, resumeFromRunId, args }) z tymi samymi args.

   Ręczna kontrola faza po fazie (zamiast autopilota): /dev-docs-execute docs/active/<nazwa> → /dev-docs-review docs/active/<nazwa> 1 → … → /dev-docs-complete <nazwa>
```

Jeśli bramka ma czerwone pozycje — `➡️ Następny krok` wskazuje najpierw ich usunięcie (setup środowiska E2E, odhaczenie przygotowania, opt-out `[E2E]` → `[Manual]`), potem **obowiązkowy commit tych zmian** (każda z tych dróg modyfikuje śledzone pliki: operator checklist ze ścieżki `operator_prep`, `docs/active/<nazwa>/`, plan techniczny, `.gitignore` po setupie e2e), np. `git add <dokładne ścieżki> && git commit -m "docs(<nazwa>): przygotowanie operatora"` i `git status --short` puste — bootstrap autopilota zatrzyma run na brudnym drzewie. Dopiero potem autopilot. Gdy użytkownik usuwa czerwone pozycje w tej samej sesji, zrób ten commit sam przed wywołaniem `Workflow`. Gdy użytkownik wybierze uruchomienie autopilota, **uruchom go toolem `Workflow`** w bieżącej sesji — nie opisuj tylko komendy.

## Referencje kontekstowe
- `.claude/rules/coding-rules.md` i `.claude/rules/learned-patterns.md` — tylko do bramki E2E (Faza 2 pkt 4); nie dopisuj z nich zadań
- `docs/CONCEPTS.md` — terminologia
- Kontrakt parsera: `.claude/workflows/dev-autopilot-wf.js` (bootstrap, sekcja „PLIKU NIE MA"), `dev-docs-execute-wf.js` (planner), `dev-docs-review-wf.js` (scribe) — gdy zmieniasz format, zmień też tam

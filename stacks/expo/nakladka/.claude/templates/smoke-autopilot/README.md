# Smoke-test pipeline'u dev-autopilot-wf (Expo)

Mikro-zadanie przepuszczające całą mechanikę pipeline'u (bootstrap → execute → review → fix → walidacja → compound → complete) na trywialnym
kodzie, z testerem Maestro na urządzeniu. Cel: wykrywać błędy workflow za grosze, zamiast odkrywać je po kilku godzinach prawdziwego runu.

## Kiedy odpalać

- Po każdej paczce zmian w `.claude/workflows/*-wf.js`, w adapterze E2E Expo albo w rolach builderów i testera.
- Przy podejrzeniu regresji pipeline'u.

## Warunki

- Projekt Expo z Expo Router i ekranem `index.tsx` w `src/app` albo `app`, z commitem w gicie: skrypt klonuje tylko to, co zacommitowane.
- Dev-client projektu zainstalowany na urządzeniu (`.claude/stack/po-fazie.md`, sekcja „Przebudowa”). Kopia ma ten sam bundle ID, więc używa tego samego dev-clienta. Commit źródła nowszy od dev-clienta, który zmienia warstwę natywną, daje STOP startu z komendą przebudowy, tak jak w projekcie.
- Maestro i Java 17+ (doctor kopii to sprawdza).
- Ekran główny za logowaniem: dopisz logowanie do flow w planie kopii, jak w `.claude/templates/e2e-env/_canary.yaml`.

## Jak użyć — zawsze na kopii projektu

```bash
bash .claude/templates/smoke-autopilot/przygotuj-kopie.sh <projekt-źródłowy> <katalog-kopii>
```

- najpierw `--dry-run`: pokazuje kroki, niczego nie tworzy;
- `--env <plik>`: atrapy zmiennych (bez sekretów) kopiowane jako `.env` kopii, gdy testy projektu bez nich nie startują;
- kopia to `git clone` lokalny bez remote, bez `.env` i `supabase/.temp`, na gałęzi `feature/smoke-autopilot`;
- sync maszynerii z lokalnego szablonu (pliki śledzone przez gita) → commit;
- fixture zadania do `docs/active/smoke-autopilot/` i `docs/plans/` z zapisem przeglądu spójności planu (bez niego autopilot zatrzymuje świeże zadanie na starcie) → commit, potem instalacja menedżerem z lockfile i `expo customize tsconfig.json`;
- doctor kopii: brak obowiązkowego narzędzia = kod 8, runu nie odpalaj;
- bazowe bramki (typecheck, testy) z logiem `.git/smoke-bramki.log`: czerwone = kod 7, runu nie odpalaj. Napraw w kopii osobnym commitem.

Potem otwórz kopię w osobnej sesji desktop (efort `medium`) i uruchom `/dev-autopilot-wf docs/active/smoke-autopilot` osobną wiadomością z samym tym poleceniem (wiadomość startową dostaje każdy agent runu; warunki i prośby wysyłasz wcześniej). Po odczycie kopię usuń, tylko za zgodą operatora na dokładną ścieżkę.

## Co fixture celowo ćwiczy

- **Celowy defekt: test niefalsyfikowalny.** Plan każe napisać happy path jako `typeof wynik === 'number'`, co przechodzi także dla `a - b`. Oczekiwane: review zgłasza P2 test-coverage, fix zastępuje asercję wartością (`toBe(5)`), kontrola fixa bez regresji.
- **Format zadania z `/dev-plan`.** Plan `plan-techniczny-smoke-autopilot.md` ma format scalonego `/dev-plan`, a pliki `smoke-autopilot-{plan,kontekst,zadania}.md` są wynikiem generatora. Po zmianie planu: `node .claude/templates/smoke-autopilot/generuj-fixture.mjs --zapisz`.
- **Pozycja `[Manual]`** (scenariusz planu → `## Operator checklist faza 1`): dodatnia gałąź fazy „Smoke operatora”.
- **E2E w dwóch fazach.** IU-2 dopisuje linie na początku ekranu głównego i tworzy flow `smoke-strona`, a IU-3 dopisuje linię i flow `smoke-strona-faza-2`. Pliki flow są deliverablem buildera (D17). Flow fazy 1 tester odgrywa przy działającym Metro: PASS z dowodem. Po restarcie Metro przed review fazy 2 operator zatrzymuje je (`node .claude/scripts/e2e/e2e.mjs stop`), więc flow fazy 2 dostaje SKIP `srodowisko` i przechodzi na `[Manual]` z powodem.
- **Bramki domknięcia.** Fixture nie wnosi konfiguracji bramek, więc biegną te, które projekt ma: wzór w `.claude/templates/bramki`. Celowe defekty: pusty `catch` w `parsujLiczbe` (ESLint) i linia komentarza w pierwszej migracji projektu (`{{MIGRACJA}}`; projekt bez migracji: ten defekt znika). `expo-doctor` uruchamia bramka `stack`, gdy faza zmieniła zależności albo konfigurację.

## Oczekiwany wynik

1. Status OK, 2 fazy, gate CZYSTE lub ZASTRZEŻENIA, zadanie zarchiwizowane, `mapa-funkcji.md` skilla weryfikacji z wpisami `smoke-strona` i `smoke-strona-faza-2`.
2. Review: co najmniej jeden potwierdzony P2 na teście happy path; fix go naprawia.
3. Bramki z konfiguracją w projekcie (pole `bramki` wyniku agenta `domkniecie:faza-1`): `eslint` porażka z `no-empty`, `migracje` porażka, `poNaprawie` obu `ok`.
4. Faza „Smoke operatora”: log `Smoke operatora: docs/operator/<data>-smoke-autopilot-smoke.md (N pozycji)` bez `[E2E] nieuruchomionych`; plik ma sekcję „E2E do odegrania ręcznie” z `smoke-strona-faza-2` i powodem; commit archiwizacji zawiera ten plik; zero wartości sekretów w pliku.

## Środowisko E2E kopii i dwa przebiegi

1. **Przebieg (1), bez środowiska:** kopia prosto ze skryptu (bez `.env.e2e`) → oczekiwany STOP `start: srodowisko E2E — …` przed fazą 1, z naprawą ze skryptu.
2. **Środowisko:** `.env.e2e` w korzeniu kopii (w `.gitignore` projektu) według `.claude/templates/e2e-env/README.md`. Canary: `cp .claude/templates/e2e-env/_canary.yaml .maestro/` i dopasowanie. Pusta baza e2e: `supabase db push --db-url "$SUPABASE_E2E_DB_URL" --include-all --yes` raz przed runem. Sprawdzenie: `node .claude/scripts/e2e/e2e.mjs sprawdz --zadanie docs/active/smoke-autopilot` = `gotowe`.
3. **Skill weryfikacji:** `/weryfikacja-setup` w kopii.
4. **Przebieg (2):** świeży run; zaraz po agencie `e2e:restart:faza-2` (log `E2E restart fazy 2`) z drugiego terminala w kopii `node .claude/scripts/e2e/e2e.mjs stop`. Wcześniejszy stop nic nie da, bo ten restart stawia Metro od nowa, a tester rusza kilka sekund po nim: spóźniony stop kończy się PASS i gałąź `[Manual]` zostaje nieprzećwiczona. Oczekiwane: `smoke-strona` PASS, `smoke-strona-faza-2` → `[Manual]` z powodem, 0 STOP-ów w trakcie, run OK.

## Pliki

- `przygotuj-kopie.sh`: kopia, fixture, doctor, bramki;
- `plan-techniczny-smoke-autopilot.md`: plan fixture'u w formacie `/dev-plan`;
- `smoke-autopilot-{plan,zadania,kontekst}.md`: pliki zadania z generatora (`generuj-fixture.mjs`), `{{KATALOG_KODU}}`, `{{EKRAN_GLOWNY}}`, `{{LINIE_EKRANU}}` i `{{MIGRACJA}}` wstawia skrypt kopii.

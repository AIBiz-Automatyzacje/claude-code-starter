# Smoke-test pipeline'u dev-autopilot-wf

Mikro-zadanie przepuszczajace CALA mechanike pipeline'u (bootstrap → warmup → execute →
review → fix → walidacja → compound → complete) w ~20 minut, na trywialnym kodzie.
Cel: wykrywac bugi WORKFLOW za grosze, zamiast odkrywac je po 3h realnego runu.

## Kiedy odpalac

- Po KAZDEJ paczce zmian w `.claude/workflows/*-wf.js` (przed merge'em do main szablonu).
- Przy podejrzeniu regresji pipeline'u.

## Jak uzyc — zawsze na KOPII projektu

Smoke nie rusza oryginalu projektu. Skrypt robi kopie w jednym kroku:

```bash
bash .claude/templates/smoke-autopilot/przygotuj-kopie.sh <projekt-zrodlowy> <katalog-kopii>
```

- najpierw `--dry-run` — pokazuje kroki, niczego nie tworzy;
- `--env <plik>` — atrapy zmiennych (BEZ sekretow) kopiowane jako `.env` kopii, gdy testy projektu bez nich nie startuja
  (oferty-online: `docs/reviews/2026-09-19-analiza-pipeline/dane/smoke-oferty-atrapy.env`); `.env` jest w `.gitignore`, git zostaje czysty;
- kopia = `git clone` lokalny, `remote remove origin` (push niemozliwy), bez `.env` i `supabase/.temp`, galaz `feature/smoke-autopilot`
  (= linia `Branch:` planu zadania z generatora — bootstrap autopilota porownuje z nia biezaca galaz),
  `.claude/.backups/` w `.git/info/exclude`;
- sync maszynerii z LOKALNEGO szablonu (pliki sledzone przez gita — zacommituj zmiany `.claude/` przed skryptem) → commit;
- fixture zadania do `docs/active/smoke-autopilot/` i `docs/plans/` + (projekt pnpm workspace) pakiet `packages/smoke-autopilot`
  z plikami z `pakiet/`, `pnpm install` → commit. Git kopii czysty;
- **doctor kopii** `.claude/scripts/doctor/doctor.sh <kopia>` — tabela narzedzi wyliczonych z projektu. Brak obowiazkowego = kod 8,
  runu NIE odpalaj: zainstaluj wg kolumny „Instalacja” i sprawdz ponownie;
- **bazowe bramki** `pnpm typecheck` + `pnpm test` w kopii (log `.git/smoke-bramki.log`). Czerwone = kod 7, runu NIE odpalaj:
  domkniecie execute uruchamia cale `pnpm test` projektu, wiec zastany czerwony test zatrzyma run niezaleznie od pakietu fixture
  (smoke P0, `wf_75b15ba0-837`: testy z data, ktora minela). Napraw w kopii osobnym commitem, sprawdz ponownie.

Potem: otworz kopie w OSOBNEJ sesji desktop (efort sesji `medium` — porownania kosztu zaleza od efortu) i uruchom
`/dev-autopilot-wf docs/active/smoke-autopilot`. Odczyt: `docs/reviews/2026-09-19-analiza-pipeline/skrypty/smoke_odczyt.py <wf_id>`
(porownanie z referencja). Po odczycie kopie usun (tylko za zgoda operatora na dokladna sciezke).

## Co fixture celowo cwiczy

- **Pakiet workspace** (`packages/smoke-autopilot`): kod zadania jest objety `pnpm -r run test` i `typecheck` kopii, odciety od
  zastanych bledow projektu. Bez tego (fixture w `src/lib` monorepo) review zawsze zglaszal kod poza bramkami i wymuszal
  przypadkowy cykl fixa. Projekt bez `pnpm-workspace.yaml` → kod w `src/lib` jak dawniej.
- **Celowy defekt: test niefalsyfikowalny.** Plan kaze napisac happy path jako `typeof wynik === 'number'` — przechodzi takze
  dla `a - b`. Oczekiwane: review zglasza P2 test-coverage na ten test, fix zastepuje asercje wartoscia (`toBe(5)`), kontrola
  fixa bez regresji. Brak findingu na tym tescie = regresja review; brak fixa = regresja petli fix.
- **Format zadania z `/dev-plan`.** Plan techniczny `plan-techniczny-smoke-autopilot.md` ma format scalonego `/dev-plan` (fazy, IU
  z tabela plikow), a pliki `smoke-autopilot-{plan,kontekst,zadania}.md` sa wynikiem generatora planowania
  (`.claude/scripts/plan/`), nie recznym zapisem. Po zmianie planu albo generatora:
  `node .claude/templates/smoke-autopilot/generuj-fixture.mjs --zapisz`; test `__tests__/fixture-zadania.test.mjs` pilnuje
  zgodnosci i walidacji planu po podstawieniu placeholderow.
- **Pozycja `[Manual]`** (scenariusz planu → `## Operator checklist faza 1` w zadaniach) — dodatnia galaz fazy "Smoke operatora" (complete-wf).
- **E2E w dwoch fazach (P14).** IU-2 tworzy statyczna strone `{{KATALOG_STRONY}}/smoke-autopilot.html` (katalog `public`
  aplikacji Vite z najplytszego `vite.config.*`, bez Vite — `public/` w korzeniu), IU-3 w fazie 2 dopisuje jej linie. Scenariusz
  `smoke-strona` (faza 1) tester odgrywa przy dzialajacym serwerze → PASS z dowodem; przed review fazy 2 operator zatrzymuje
  serwer → scenariusz `smoke-strona-faza-2` dostaje SKIP `srodowisko` → `[Manual]` z powodem, reszta runu bez przegladarki.
  Kopia bez `.env.e2e` zatrzymuje run w bootstrapie (STOP `start: srodowisko E2E`) — przebieg (1) ponizej.
- **Bramki domkniecia (P6).** Pakiet dostaje konfiguracje z `.claude/templates/bramki` i devDependencies bramek
  (`wstaw-pakiet.mjs`), plus `build` dla size-limit. Celowe defekty mechaniczne z planu: pusty `catch` w `parsujLiczbe` i linia
  komentarza dopisana do pierwszej migracji projektu (`{{MIGRACJA}}`; projekt bez migracji — ten defekt znika z fixture).
  Bramki z korzenia kopii biegna tez w pakiecie (wlasne narzedzia), migracje sprawdzaja w korzeniu.

## Oczekiwany wynik i asercje

1. Status OK, 2 fazy, gate CZYSTE lub ZASTRZEZENIA, zadanie zarchiwizowane, `mapa-funkcji.md` skilla weryfikacji z wpisami `smoke-strona` i `smoke-strona-faza-2`.
2. Review: >= 1 potwierdzony P2 na tescie happy path; fix go naprawia.
2a. Bramki (wynik agenta `domkniecie:faza-1` w `journal.jsonl`, pole `bramki`): `eslint` porazka z `no-empty`,
   `migracje` porazka; `poNaprawie` obu = `ok`; `stryker` z trafieniami (pole `mutanty` niepuste — test `typeof` przepuszcza
   mutanty sumy); suma `sekundy` bramek <= 143. Commit fazy: migracja bez zmian wzgledem bazy, `catch` raportuje albo rzuca,
   nowy `supabase/migrations.sum`. Rekord telemetrii fazy: `bramki.eslint.status = "porazka"`.
3. Asercje fazy "Smoke operatora" (complete-wf):
   - log complete-wf: `Smoke operatora: docs/operator/<data>-smoke-autopilot-smoke.md (N pozycji)` BEZ fragmentu
     `UWAGA: ... [E2E] nieuruchomionych` (e2eNieuruchomione musi byc 0: `smoke-strona` odznaczony po PASS,
     `smoke-strona-faza-2` przeniesiony na `[Manual]`); plik ma sekcje „E2E do odegrania recznie (srodowisko w trakcie runu)”
     z `smoke-strona-faza-2` i powodem;
   - log autopilota: `Smoke operatora do przejscia recznie: docs/operator/<data>-smoke-autopilot-smoke.md`; pole
     `smokeOperatora` w wyniku niepuste, `smokeStatus: "plik"`;
   - plik istnieje i `grep -c '^- \[ \]' docs/operator/<data>-smoke-autopilot-smoke.md` >= 1, zero wartosci sekretow w pliku;
   - `git show --stat HEAD` commita archiwizacji zawiera `docs/operator/...-smoke.md` (krok 8 `git add`).
   Wariant negatywny (drugi run): usun scenariusz `[Manual]` z planu technicznego kopii, wygeneruj zadanie ponownie
   (`node .claude/scripts/plan/plan.mjs generuj docs/plans/plan-techniczny-smoke-autopilot.md --nazwa smoke-autopilot --zapisz --nadpisz`)
   i zacommituj plan z katalogiem zadania (bootstrap zatrzyma run na zmienionym planie technicznym) → oczekiwane
   `Smoke operatora: brak pozycji do recznego sprawdzenia — plik nie powstal`, `smokeStatus: "brak-pozycji"`, brak pliku w `docs/operator/`.

4. Ogrodnik (P15): w journalu jeden agent `ogrod:pomiar` (klasa `klasa-mechaniczny-pomiar`) po `compound-refresh`, przed
   `smoke-operatora`; `ogrod:ocena` tylko gdy log `Ogrod: …` podaje powod oceny (w swiezej kopii pierwszy pomiar: przyrost
   z linii dodanych przez zadanie). Podsumowanie `docs/completed/smoke-autopilot/smoke-autopilot-podsumowanie.md` konczy sie
   sekcja `## Ogród` (liczby z przyrostem, zdanie o braku zmian w kodzie). Agenci ogrodnika bez commitow i bez Edit/Write
   w transkrypcie; wynik runu i rekord telemetrii `run.ogrod` ze `status: "ok"`.

## Srodowisko E2E kopii i dwa przebiegi (P14)

1. **Przebieg (1) — bez srodowiska:** kopia prosto ze skryptu (bez `.env.e2e`) → `/dev-autopilot-wf docs/active/smoke-autopilot`
   → oczekiwany STOP `start: srodowisko E2E — …` przed faza 1, z naprawa ze skryptu i poleceniem swiezego runu.
2. **Srodowisko:** `.env.e2e` w korzeniu kopii (w `.gitignore` projektu) z kluczami dedykowanej bazy e2e (`.claude/templates/e2e-env/README.md`)
   i komenda startu samej aplikacji z Vite — w monorepo `pnpm run dev` korzenia uruchamia wszystkie pakiety i przekazuje im flagi
   Vite. Przyklad monorepo z pakietem `@oferty/dashboard`: `E2E_START="pnpm --filter @oferty/dashboard exec vite --mode e2e --port 5173 --strictPort"`.
   Pusta baza e2e: `supabase db push --db-url "$SUPABASE_E2E_DB_URL" --include-all` raz przed runem (db-sync fazy jest wtedy
   przyrostowy). Sprawdzenie: `node .claude/scripts/e2e/e2e.mjs sprawdz --zadanie docs/active/smoke-autopilot` = `gotowe`.
3. **Skill weryfikacji:** `/weryfikacja-setup` w kopii (szkielet, fakty z kodu, przejscie na zywo, commit) — tester czyta
   `.claude/skills/weryfikacja/`, a archiwizacja dopisuje flow zadania do `mapa-funkcji.md`.
4. **Przebieg (2):** swiezy run; po domknieciu fazy 1 (log `Faza 2` / execute fazy 2 w toku) z drugiego terminala w kopii
   `node .claude/scripts/e2e/e2e.mjs stop`. Oczekiwane: `smoke-strona` PASS z dowodem, `smoke-strona-faza-2` → `[Manual]`
   z powodem, 0 STOP-ow w trakcie, run OK; telemetria `faza.e2e.manual` = 1 w fazie 2, `run.manual_razem` = 1.

## Test resume (scenariusz celowy)

Po jednym pelnym przebiegu mozna przetestowac wznowienie od fixa:
1. Przywroc folder z `docs/completed/smoke-autopilot/` do `docs/active/`.
2. W `.autopilot-state.json` ustaw fazie 1: `"fix": "pending"` i wstaw 1 sztuczny finding do
   `otwarteFindingi` (np. `{"severity":"P2","typ":"TEST","plik":"packages/smoke-autopilot/src/smoke-autopilot.ts","opis":"brakuje testu wartosci ujemnych"}`),
   `zakonczenie` ustaw na pending.
3. Odpal ponownie (swiezy run) — orkiestrator MUSI pojsc PROSTO do fixa (zero execute, zero review).
   W logach: brak `Execute OK`, brak linii `Review fazy 1:`, jest `Fix fazy 1:`.

## Pliki

- `przygotuj-kopie.sh` + `__tests__/przygotuj-kopie.test.mjs` (skladnia, `--dry-run`);
- `pakiet/` — `package.json`, `tsconfig.json`, `vitest.config.ts` pakietu fixture (`passWithNoTests`: przed build pakiet nie ma testow);
- `wstaw-pakiet.mjs` + `__tests__/wstaw-pakiet.test.mjs` — pakiet z konfiguracjami i devDependencies bramek (P6);
- `plan-techniczny-smoke-autopilot.md` — plan techniczny fixture'u w formacie `/dev-plan`;
- `smoke-autopilot-{plan,zadania,kontekst}.md` — pliki zadania z generatora (`generuj-fixture.mjs` + `__tests__/fixture-zadania.test.mjs`);
  `{{KATALOG_KODU}}`, `{{KATALOG_STRONY}}` i `{{MIGRACJA}}` wstawia skrypt kopii.

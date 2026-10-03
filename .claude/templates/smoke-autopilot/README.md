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
- kopia = `git clone` lokalny, `remote remove origin` (push niemozliwy), bez `.env` i `supabase/.temp`, galaz `test/smoke-autopilot`,
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
- **Pozycja `[Manual]`** w `## Operator checklist faza 1` — dodatnia galaz fazy "Smoke operatora" (complete-wf).
- **Bramki domkniecia (P6).** Pakiet dostaje konfiguracje z `.claude/templates/bramki` i devDependencies bramek
  (`wstaw-pakiet.mjs`), plus `build` dla size-limit. Celowe defekty mechaniczne z planu: pusty `catch` w `parsujLiczbe` i linia
  komentarza dopisana do pierwszej migracji projektu (`{{MIGRACJA}}`; projekt bez migracji — ten defekt znika z fixture).
  Bramki z korzenia kopii biegna tez w pakiecie (wlasne narzedzia), migracje sprawdzaja w korzeniu.

## Oczekiwany wynik i asercje

1. Status OK, 1 faza, gate CZYSTE lub ZASTRZEZENIA, zadanie zarchiwizowane.
2. Review: >= 1 potwierdzony P2 na tescie happy path; fix go naprawia.
2a. Bramki (wynik agenta `domkniecie:faza-1` w `journal.jsonl`, pole `bramki`): `eslint` porazka z `no-empty`,
   `migracje` porazka; `poNaprawie` obu = `ok`; `stryker` z trafieniami (pole `mutanty` niepuste — test `typeof` przepuszcza
   mutanty sumy); suma `sekundy` bramek <= 143. Commit fazy: migracja bez zmian wzgledem bazy, `catch` raportuje albo rzuca,
   nowy `supabase/migrations.sum`. Rekord telemetrii fazy: `bramki.eslint.status = "porazka"`.
3. Asercje fazy "Smoke operatora" (complete-wf):
   - log complete-wf: `Smoke operatora: docs/operator/<data>-smoke-autopilot-smoke.md (N pozycji)` BEZ fragmentu
     `UWAGA: ... [E2E] nieuruchomionych` (e2eNieuruchomione musi byc 0; fixture celowo nie ma `[E2E]`, bo bramka setupu
     zatrzymalaby run bez `.env.e2e`);
   - log autopilota: `Smoke operatora do przejscia recznie: docs/operator/<data>-smoke-autopilot-smoke.md`; pole
     `smokeOperatora` w wyniku niepuste, `smokeStatus: "plik"`;
   - plik istnieje i `grep -c '^- \[ \]' docs/operator/<data>-smoke-autopilot-smoke.md` >= 1, zero wartosci sekretow w pliku;
   - `git show --stat HEAD` commita archiwizacji zawiera `docs/operator/...-smoke.md` (krok 8 `git add`).
   Wariant negatywny (drugi run): usun sekcje `## Operator checklist faza 1` z fixture → oczekiwane
   `Smoke operatora: brak pozycji do recznego sprawdzenia — plik nie powstal`, `smokeStatus: "brak-pozycji"`, brak pliku w `docs/operator/`.

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
- `smoke-autopilot-{plan,zadania,kontekst}.md`, `plan-techniczny-smoke-autopilot.md` — fixture zadania; `{{KATALOG_KODU}}` wstawia skrypt.

# Smoke-test pipeline'u dev-autopilot-wf

Mikro-zadanie przepuszczajace CALA mechanike pipeline'u (bootstrap → warmup → execute →
review → fix → walidacja → compound → complete) w kilka-kilkanascie minut, na trywialnym kodzie.
Cel: wykrywac bugi WORKFLOW za grosze, zamiast odkrywac je po 3h realnego runu.

## Kiedy odpalac

- Po KAZDEJ zmianie plikow `.claude/workflows/*-wf.js` (przed kopiowaniem do projektu / przed runem w boju).
- Przy podejrzeniu regresji pipeline'u.

## Jak uzyc (w projekcie docelowym)

1. Skopiuj zawartosc tego folderu (bez README):
   - `smoke-autopilot-plan.md`, `smoke-autopilot-zadania.md`, `smoke-autopilot-kontekst.md`
     → `docs/active/smoke-autopilot/`
   - `plan-techniczny-smoke-autopilot.md` → `docs/plans/`
2. Upewnij sie ze git jest czysty i jestes na branchu roboczym (np. `test/smoke-autopilot`).
3. Odpal: `/dev-autopilot-wf docs/active/smoke-autopilot`
4. Oczekiwany wynik: status OK, 1 faza, gate CZYSTE lub ZASTRZEZENIA, zadanie zarchiwizowane.

## Test resume (Bug 1 — scenariusz celowy)

Po jednym pelnym przebiegu mozna przetestowac wznowienie od fixa:
1. Przywroc folder z `docs/completed/smoke-autopilot/` do `docs/active/`.
2. W `.autopilot-state.json` ustaw fazie 1: `"fix": "pending"` i wstaw 1 sztuczny finding do
   `otwarteFindingi` (np. `{"severity":"P2","typ":"TEST","plik":"src/lib/smoke-autopilot.ts","opis":"brakuje testu wartosci ujemnych"}`),
   `zakonczenie` ustaw na pending.
3. Odpal ponownie — orkiestrator MUSI pojsc PROSTO do fixa (zero execute, zero review).
   W logach: brak `Execute OK`, brak linii `Review fazy 1:`, jest `Fix fazy 1:`.

## Sprzatanie po smoke

- `git log --oneline` → revert/usun commity smoke (feat/fix/docs ze "smoke-autopilot").
- Usun `src/lib/smoke-autopilot.ts` + test (jesli revert ich nie zdjal).
- Usun `docs/completed/smoke-autopilot/` i wpisy w dokumentacji projektu, jesli complete cos dopisal.

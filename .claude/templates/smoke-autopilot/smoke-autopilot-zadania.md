# Zadania: smoke-autopilot

Branch: `feature/smoke-autopilot`
Ostatnia aktualizacja: 2026-10-07
Plan techniczny: `docs/plans/plan-techniczny-smoke-autopilot.md`

Checkboxy odsyłają do jednostek planu technicznego (IU-K): cel, podejście, decyzje i teksty są tylko tam.

## Faza 1 — Funkcja pomocnicza

Zależy od: Brak

### IU-1: dodajBezpiecznie (feature-builder-data)

- [ ] Stwórz: `{{KATALOG_KODU}}/smoke-autopilot.ts`
- [ ] Test (unit): `{{KATALOG_KODU}}/smoke-autopilot.test.ts`
- [ ] Modyfikuj: `{{MIGRACJA}}`
- [ ] Test: [Unit] happy path: wynik `dodajBezpiecznie(2, 3)` jest liczbą — `expect(typeof dodajBezpiecznie(2, 3)).toBe('number')`
- [ ] Test: [Unit] `dodajBezpiecznie(NaN, 1)` rzuca TypeError
- [ ] Test: [Unit] `dodajBezpiecznie(Infinity, 1)` rzuca TypeError
- [ ] Test: [Unit] `parsujLiczbe('7')` zwraca 7
- [ ] Weryfikacja: `pnpm typecheck` przechodzi bez nowych błędów

### IU-2: strona diagnostyczna (feature-builder-ui)

- [ ] Stwórz: `{{KATALOG_STRONY}}/smoke-autopilot.html`
- [ ] Test: [E2E] `smoke-strona` — otwórz `/smoke-autopilot.html`, zrób screenshot → widoczny nagłówek „Smoke autopilot” i tekst „dodajBezpiecznie(2, 3) = 5”

## Operator checklist faza 1

- [ ] [Manual] wywołaj `dodajBezpiecznie(NaN, 1)` w REPL albo konsoli i sprawdź, że komunikat TypeError jest czytelny dla człowieka (IU-1)

## Faza 2 — Druga linia strony

Zależy od: Faza 1

### IU-3: linia fazy 2 (feature-builder-ui)

- [ ] Modyfikuj: `{{KATALOG_STRONY}}/smoke-autopilot.html`
- [ ] Test: [E2E] `smoke-strona-faza-2` — otwórz `/smoke-autopilot.html`, zrób screenshot → widoczny tekst „Faza 2: gotowe” pod wynikiem przykładu

# Zadania: smoke-autopilot

Plan techniczny: docs/plans/plan-techniczny-smoke-autopilot.md

## Faza 1: Funkcja pomocnicza

- [ ] Utworz `src/lib/smoke-autopilot.ts` z funkcja `dodajBezpiecznie(a: number, b: number): number`
      (rzuca TypeError dla NaN/Infinity, inaczej zwraca sume)
- [ ] Test: happy path — `dodajBezpiecznie(2, 3)` zwraca 5
- [ ] Test: error case — `dodajBezpiecznie(NaN, 1)` rzuca TypeError
- [ ] Weryfikacja: CLI `typecheck` przechodzi bez nowych bledow

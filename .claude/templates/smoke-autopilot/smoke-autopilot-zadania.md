# Zadania: smoke-autopilot

Plan techniczny: docs/plans/plan-techniczny-smoke-autopilot.md

## Faza 1 — Funkcja pomocnicza

### IU-1: dodajBezpiecznie (feature-builder-data)

- [ ] Utworz `src/lib/smoke-autopilot.ts` z funkcja `dodajBezpiecznie(a: number, b: number): number`
      (rzuca TypeError dla NaN/Infinity, inaczej zwraca sume)
- [ ] Test: [Unit] happy path — `dodajBezpiecznie(2, 3)` zwraca 5
- [ ] Test: [Unit] error case — `dodajBezpiecznie(NaN, 1)` rzuca TypeError
- [ ] Weryfikacja: CLI `typecheck` przechodzi bez nowych bledow

## Operator checklist faza 1

- [ ] [Manual] Wywolaj `dodajBezpiecznie(NaN, 1)` w REPL/konsoli i sprawdz, ze komunikat TypeError jest czytelny dla czlowieka (IU-1)

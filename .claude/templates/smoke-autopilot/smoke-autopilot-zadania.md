# Zadania: smoke-autopilot

Plan techniczny: docs/plans/plan-techniczny-smoke-autopilot.md

## Faza 1 — Funkcja pomocnicza

### IU-1: dodajBezpiecznie (feature-builder-data)

- [ ] Utworz `{{KATALOG_KODU}}/smoke-autopilot.ts` z funkcja `dodajBezpiecznie(a: number, b: number): number`
      (rzuca TypeError dla NaN/Infinity, inaczej zwraca sume)
- [ ] Test: [Unit] happy path — `dodajBezpiecznie(2, 3)` zwraca liczbe (`typeof` = `number`)
- [ ] Test: [Unit] error case — `dodajBezpiecznie(NaN, 1)` rzuca TypeError
- [ ] Dodaj w tym samym pliku `parsujLiczbe(tekst: string): number | null` dokladnie wg planu technicznego (pusty `catch` — celowy defekt)
- [ ] Test: [Unit] `parsujLiczbe('7')` zwraca 7
- [ ] Dopisz na koncu `{{MIGRACJA}}` linie komentarza wg planu technicznego (celowy defekt)
- [ ] Weryfikacja: CLI `typecheck` przechodzi bez nowych bledow

## Operator checklist faza 1

- [ ] [Manual] Wywolaj `dodajBezpiecznie(NaN, 1)` w REPL/konsoli i sprawdz, ze komunikat TypeError jest czytelny dla czlowieka (IU-1)

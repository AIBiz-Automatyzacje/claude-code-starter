# Plan techniczny: smoke-autopilot

origin: docs/active/smoke-autopilot/

## Faza 1: Funkcja pomocnicza

### IU-1: dodajBezpiecznie

Delegate to: feature-builder-data

**Cel:** Funkcja pomocnicza `dodajBezpiecznie` z walidacja wejscia, wraz z testami.

**Wymagania:**
- `dodajBezpiecznie(a: number, b: number): number` — zwraca a+b.
- Dla argumentow NaN lub nieskonczonych rzuca `TypeError` z czytelnym komunikatem.
- Explicit return type, zero `any`.

**Pliki:**
- `src/lib/smoke-autopilot.ts` (nowy)
- `src/lib/smoke-autopilot.test.ts` (nowy, kolokacja obok zrodla)

**Podejscie:** Fail fast — walidacja `Number.isFinite` na poczatku, potem suma. Jeden eksport.

**Wzorce:** Konwencje repo (kebab-case, named export, vitest describe/it + Arrange-Act-Assert).

**Scenariusze testowe:**
- happy path: `dodajBezpiecznie(2, 3) === 5`
- error case: `dodajBezpiecznie(NaN, 1)` rzuca TypeError
- error case: `dodajBezpiecznie(Infinity, 1)` rzuca TypeError

**Weryfikacja:**
- [ ] CLI: typecheck przechodzi bez nowych bledow

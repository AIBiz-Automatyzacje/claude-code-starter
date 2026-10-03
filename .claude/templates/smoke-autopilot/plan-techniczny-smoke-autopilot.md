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
- `parsujLiczbe(tekst: string): number | null` w tym samym pliku — DOKLADNIE ten kod (celowy defekt mechaniczny smoke'a:
  pusty `catch` naprawia domkniecie fazy po bramce ESLint, nie builder):
  ```ts
  export function parsujLiczbe(tekst: string): number | null {
    try {
      return Number(BigInt(tekst))
    } catch {}
    return null
  }
  ```
- Na koncu istniejacej migracji `{{MIGRACJA}}` dopisz linie `-- smoke-autopilot: edycja wypchnietej migracji` (celowy defekt mechaniczny smoke'a: przywraca ja domkniecie fazy po bramce niezmiennosci migracji, nie builder).

**Pliki:**
- `{{KATALOG_KODU}}/smoke-autopilot.ts` (nowy)
- `{{KATALOG_KODU}}/smoke-autopilot.test.ts` (nowy, kolokacja obok zrodla)
- `{{MIGRACJA}}` (jedna linia komentarza na koncu)

**Podejscie:** Fail fast — walidacja `Number.isFinite` na poczatku, potem suma. Jeden eksport.

**Wzorce:** Konwencje repo (kebab-case, named export, vitest describe/it + Arrange-Act-Assert).

**Scenariusze testowe (dokladnie te cztery, bez dodatkowych):**
- happy path: wynik `dodajBezpiecznie(2, 3)` jest liczba — `expect(typeof dodajBezpiecznie(2, 3)).toBe('number')`
- error case: `dodajBezpiecznie(NaN, 1)` rzuca TypeError
- error case: `dodajBezpiecznie(Infinity, 1)` rzuca TypeError
- `parsujLiczbe('7')` zwraca 7

**Weryfikacja:**
- [ ] CLI: typecheck przechodzi bez nowych bledow

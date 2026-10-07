---
title: "test: smoke-autopilot"
type: feat
status: active
date: 2026-10-07
origin: null
design_md: null
figma_spec: null
figma_screens: {}
operator_prep: null
---

# test: smoke-autopilot

## Przegląd

Zadanie-atrapa do smoke-testu pipeline'u dev-autopilot-wf: jedna czysta funkcja pomocnicza z testami i celowymi defektami dla review, fixa i bramek domknięcia. Wartość biznesowa zerowa, diagnostyczna — cała.

## Śledzenie wymagań

- R1. `dodajBezpiecznie(a: number, b: number): number` zwraca sumę argumentów.
- R2. Dla argumentu NaN albo nieskończonego `dodajBezpiecznie` rzuca `TypeError` z czytelnym komunikatem.
- R3. `parsujLiczbe(tekst: string): number | null` w tym samym pliku zwraca liczbę albo `null`.

## Granice zakresu

- Bez UI, bazy i zależności zewnętrznych.

## Kluczowe decyzje techniczne

- Celowe defekty smoke'a: test happy path niefalsyfikowalny (`typeof`), pusty `catch` w `parsujLiczbe` i linia komentarza w wypchniętej migracji. Naprawia je review z fixem i domknięcie fazy, nie builder.

## Rejestr stałych

Brak stałych współdzielonych.

## Wymagania wstępne operatora

Brak — autopilot może startować od razu.

## Implementation Units

### Faza 1 — Funkcja pomocnicza

**Zależy od:** Brak

- [ ] **IU-1: dodajBezpiecznie**

**Cel:** Funkcja `dodajBezpiecznie` z walidacją wejścia i `parsujLiczbe`, wraz z testami.

**Wymagania:** R1, R2, R3

**Zależności:** Brak

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `{{KATALOG_KODU}}/smoke-autopilot.ts` | 0 → 20 | — | nowy |
| Test (unit) | `{{KATALOG_KODU}}/smoke-autopilot.test.ts` | 0 → 25 | — | nowy |
| Modyfikuj | `{{MIGRACJA}}` | — → — | — | zostaje |

**Delegate to:** feature-builder-data

**Skills in play:** supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- Fail fast: walidacja `Number.isFinite` na początku, potem suma; jawny typ zwracany, bez `any`; jeden plik, eksporty nazwane.
- `parsujLiczbe` dokładnie w tym brzmieniu (celowy defekt mechaniczny: pusty `catch` naprawia domknięcie fazy po bramce ESLint, nie builder):
  ```ts
  export function parsujLiczbe(tekst: string): number | null {
    try {
      return Number(BigInt(tekst))
    } catch {}
    return null
  }
  ```
- Na końcu istniejącej migracji `{{MIGRACJA}}` dopisz linię `-- smoke-autopilot: edycja wypchniętej migracji` (celowy defekt mechaniczny: przywraca ją domknięcie fazy po bramce niezmienności migracji, nie builder).

**Wzorce do naśladowania:**
- Konwencje repo: kebab-case, eksport nazwany, vitest describe/it z Arrange-Act-Assert, test obok pliku źródłowego.

**Scenariusze testowe (dokładnie te cztery testy jednostkowe, bez dodatkowych):**
- [Unit] happy path: wynik `dodajBezpiecznie(2, 3)` jest liczbą — `expect(typeof dodajBezpiecznie(2, 3)).toBe('number')`
- [Unit] `dodajBezpiecznie(NaN, 1)` rzuca TypeError
- [Unit] `dodajBezpiecznie(Infinity, 1)` rzuca TypeError
- [Unit] `parsujLiczbe('7')` zwraca 7
- [Manual] wywołaj `dodajBezpiecznie(NaN, 1)` w REPL albo konsoli i sprawdź, że komunikat TypeError jest czytelny dla człowieka

**Weryfikacja:**
- `pnpm typecheck` przechodzi bez nowych błędów

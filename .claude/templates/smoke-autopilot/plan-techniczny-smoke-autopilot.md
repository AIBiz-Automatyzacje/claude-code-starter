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

Zadanie-atrapa do smoke-testu pipeline'u dev-autopilot-wf: jedna czysta funkcja pomocnicza z testami i celowymi defektami dla review, fixa i bramek domknięcia oraz statyczna strona diagnostyczna dla testera E2E w dwóch fazach. Wartość biznesowa zerowa, diagnostyczna — cała.

## Śledzenie wymagań

- R1. `dodajBezpiecznie(a: number, b: number): number` zwraca sumę argumentów.
- R2. Dla argumentu NaN albo nieskończonego `dodajBezpiecznie` rzuca `TypeError` z czytelnym komunikatem.
- R3. `parsujLiczbe(tekst: string): number | null` w tym samym pliku zwraca liczbę albo `null`.
- R4. Statyczna strona `/smoke-autopilot.html` w aplikacji pokazuje nagłówek „Smoke autopilot” i wynik przykładu `dodajBezpiecznie(2, 3) = 5`.
- R5. Ta sama strona pokazuje linię „Faza 2: gotowe”.

## Granice zakresu

- Bez bazy i zależności zewnętrznych; strona diagnostyczna jest statycznym plikiem HTML bez skryptu i bez trasy w routerze aplikacji.

## Kluczowe decyzje techniczne

- Celowe defekty smoke'a: test happy path niefalsyfikowalny (`typeof`), pusty `catch` w `parsujLiczbe` i linia komentarza w wypchniętej migracji. Naprawia je review z fixem i domknięcie fazy, nie builder.
- Strona `smoke-autopilot.html` leży w katalogu plików statycznych aplikacji (serwer dev podaje ją pod `/smoke-autopilot.html`) i ma wynik wpisany tekstem: to cel scenariuszy E2E smoke'a, nie kod produkcyjny. Scenariusz fazy 1 odgrywa tester przy działającym serwerze; przed review fazy 2 operator zatrzymuje serwer, więc scenariusz fazy 2 przechodzi w trakcie runu do testu ręcznego operatora.

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

- [ ] **IU-2: strona diagnostyczna**

**Cel:** Statyczna strona HTML z wynikiem przykładu, którą tester E2E otwiera w przeglądarce.

**Wymagania:** R4

**Zależności:** Brak

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `{{KATALOG_STRONY}}/smoke-autopilot.html` | 0 → 11 | — | nowy |

**Delegate to:** feature-builder-ui

**Skills in play:** brak

**Podejście:**
- Plik dokładnie w tym brzmieniu (bez skryptu, stylów i wpisu w routerze):
  ```html
  <!doctype html>
  <html lang="pl">
    <head>
      <meta charset="utf-8" />
      <title>Smoke autopilot</title>
    </head>
    <body>
      <h1>Smoke autopilot</h1>
      <p data-testid="wynik">dodajBezpiecznie(2, 3) = 5</p>
    </body>
  </html>
  ```

**Wzorce do naśladowania:**
- Pliki statyczne aplikacji w katalogu `{{KATALOG_STRONY}}`.

**Scenariusze testowe:**
- [E2E] `smoke-strona` — otwórz `/smoke-autopilot.html`, zrób screenshot → widoczny nagłówek „Smoke autopilot” i tekst „dodajBezpiecznie(2, 3) = 5”

### Faza 2 — Druga linia strony

**Zależy od:** Faza 1

- [ ] **IU-3: linia fazy 2**

**Cel:** Strona diagnostyczna pokazuje linię „Faza 2: gotowe”.

**Wymagania:** R5

**Zależności:** IU-2

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Modyfikuj | `{{KATALOG_STRONY}}/smoke-autopilot.html` | 11 → 12 | — | zostaje |

**Delegate to:** feature-builder-ui

**Skills in play:** brak

**Podejście:**
- Pod akapitem `data-testid="wynik"` dopisz dokładnie `<p data-testid="faza-2">Faza 2: gotowe</p>`; reszta pliku bez zmian.

**Wzorce do naśladowania:**
- Akapit `data-testid="wynik"` z IU-2.

**Scenariusze testowe:**
- [E2E] `smoke-strona-faza-2` — otwórz `/smoke-autopilot.html`, zrób screenshot → widoczny tekst „Faza 2: gotowe” pod wynikiem przykładu

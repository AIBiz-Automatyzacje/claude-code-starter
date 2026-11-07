---
title: "test: smoke-autopilot"
type: feat
status: active
date: 2026-11-07
origin: null
design_md: null
figma_spec: null
figma_screens: {}
operator_prep: null
---

# test: smoke-autopilot

## Przegląd

Zadanie-atrapa do smoke-testu pipeline'u dev-autopilot-wf na Expo: jedna czysta funkcja pomocnicza z testami i celowymi defektami dla review, fixa i bramek domknięcia oraz dwie linie na ekranie głównym dla testera E2E w dwóch fazach. Wartość biznesowa zerowa, diagnostyczna — cała.

## Śledzenie wymagań

- R1. `dodajBezpiecznie(a: number, b: number): number` zwraca sumę argumentów.
- R2. Dla argumentu NaN albo nieskończonego `dodajBezpiecznie` rzuca `TypeError` z czytelnym komunikatem.
- R3. `parsujLiczbe(tekst: string): number | null` w tym samym pliku zwraca liczbę albo `null`.
- R4. Ekran główny pokazuje nagłówek „Smoke autopilot” i wynik przykładu `dodajBezpiecznie(2, 3) = 5`.
- R5. Ten sam ekran pokazuje linię „Faza 2: gotowe”.

## Granice zakresu

- Bez bazy i zależności zewnętrznych; bez nowej trasy, bo trasa spoza układu kart bywa nieosiągalna linkiem, a fixture ma działać w każdym projekcie.

## Kluczowe decyzje techniczne

- Celowe defekty smoke'a: test happy path niefalsyfikowalny (`typeof`), pusty `catch` w `parsujLiczbe` i linia komentarza w wypchniętej migracji. Naprawia je review z fixem i domknięcie fazy, nie builder.
- Linie smoke'a leżą na początku ekranu głównego z wynikiem wpisanym tekstem: to cel scenariuszy E2E smoke'a, nie kod produkcyjny. Scenariusz fazy 1 odgrywa tester przy działającym Metro; przed review fazy 2 operator zatrzymuje Metro, więc scenariusz fazy 2 przechodzi w trakcie runu do testu ręcznego operatora.
- Pliki flow są deliverablem buildera, a ich treść stoi w planie, żeby smoke sprawdzał pipeline, nie pomysł modelu na wejście do aplikacji.

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
- Konwencje repo: kebab-case, eksport nazwany, jest describe/it z Arrange-Act-Assert, test obok pliku źródłowego.

**Scenariusze testowe (dokładnie te cztery testy jednostkowe, bez dodatkowych):**
- [Unit] happy path: wynik `dodajBezpiecznie(2, 3)` jest liczbą — `expect(typeof dodajBezpiecznie(2, 3)).toBe('number')`
- [Unit] `dodajBezpiecznie(NaN, 1)` rzuca TypeError
- [Unit] `dodajBezpiecznie(Infinity, 1)` rzuca TypeError
- [Unit] `parsujLiczbe('7')` zwraca 7
- [Manual] wywołaj `dodajBezpiecznie(NaN, 1)` w konsoli dev-clienta i sprawdź, że komunikat TypeError jest czytelny dla człowieka

**Weryfikacja:**
- `npx tsc --noEmit` przechodzi bez nowych błędów

- [ ] **IU-2: linie na ekranie głównym**

**Cel:** Ekran główny pokazuje nagłówek i wynik przykładu, które tester E2E sprawdza flow Maestro.

**Wymagania:** R4

**Zależności:** Brak

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Modyfikuj | `{{EKRAN_GLOWNY}}` | {{LINIE_EKRANU}} | — | zostaje |
| Stwórz (e2e flow) | `.maestro/smoke-strona.yaml` | 0 → 16 | — | nowy |

**Delegate to:** feature-builder-ui

**Skills in play:** rn-expo-guidelines, ux-ui-guidelines-mobile, uniwind

**Podejście:**
- Na początku widoku `{{EKRAN_GLOWNY}}` dopisz dokładnie te dwa elementy (bez nowych komponentów i stylów; `Text` z `react-native`):
  ```tsx
  <Text>Smoke autopilot</Text>
  <Text testID="smoke-wynik">dodajBezpiecznie(2, 3) = 5</Text>
  ```
- Plik `.maestro/smoke-strona.yaml` dokładnie w tym brzmieniu:
  ```yaml
  appId: ${APP_ID}
  ---
  - stopApp
  - openLink: "${APP_SCHEME}://expo-development-client/?url=${METRO_URL}"
  - tapOn:
      text: "Otwórz|Open"
      optional: true
  - extendedWaitUntil:
      visible:
        id: "smoke-wynik"
      timeout: 90000
  - assertVisible: "Smoke autopilot"
  - assertVisible:
      id: "smoke-wynik"
      text: "dodajBezpiecznie\\(2, 3\\) = 5"
  - takeScreenshot: smoke-strona
  ```

**Wzorce do naśladowania:**
- Istniejąca treść ekranu `{{EKRAN_GLOWNY}}`.

**Scenariusze testowe:**
- [E2E] `smoke-strona` — stopApp, openLink do dev-clienta, assertVisible „Smoke autopilot”, takeScreenshot → widoczny nagłówek i tekst „dodajBezpiecznie(2, 3) = 5”

### Faza 2 — Druga linia ekranu

**Zależy od:** Faza 1

- [ ] **IU-3: linia fazy 2**

**Cel:** Ekran główny pokazuje linię „Faza 2: gotowe”.

**Wymagania:** R5

**Zależności:** IU-2

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Modyfikuj | `{{EKRAN_GLOWNY}}` | {{LINIE_EKRANU}} | — | zostaje |
| Stwórz (e2e flow) | `.maestro/smoke-strona-faza-2.yaml` | 0 → 13 | — | nowy |

**Delegate to:** feature-builder-ui

**Skills in play:** rn-expo-guidelines, ux-ui-guidelines-mobile, uniwind

**Podejście:**
- Pod elementem `testID="smoke-wynik"` dopisz dokładnie `<Text testID="smoke-faza-2">Faza 2: gotowe</Text>`; reszta pliku bez zmian.
- Plik `.maestro/smoke-strona-faza-2.yaml` dokładnie w tym brzmieniu:
  ```yaml
  appId: ${APP_ID}
  ---
  - stopApp
  - openLink: "${APP_SCHEME}://expo-development-client/?url=${METRO_URL}"
  - tapOn:
      text: "Otwórz|Open"
      optional: true
  - extendedWaitUntil:
      visible:
        id: "smoke-faza-2"
      timeout: 90000
  - assertVisible: "Faza 2: gotowe"
  - takeScreenshot: smoke-strona-faza-2
  ```

**Wzorce do naśladowania:**
- Element `testID="smoke-wynik"` z IU-2.

**Scenariusze testowe:**
- [E2E] `smoke-strona-faza-2` — stopApp, openLink do dev-clienta, assertVisible „Faza 2: gotowe”, takeScreenshot → widoczny tekst „Faza 2: gotowe” pod wynikiem przykładu

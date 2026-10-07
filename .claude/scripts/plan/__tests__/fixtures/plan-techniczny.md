---
title: "feat: Publikacja ofert"
type: feat
status: active
date: 2026-10-07
origin: docs/brainstorms/2026-10-01-publikacja-ofert-requirements.md
design_md: ./docs/DESIGN.md
figma_spec: ./docs/plans/publikacja-ofert-figma/SPEC.md
figma_screens:
  lista-ofert: ./docs/plans/publikacja-ofert-figma/lista-ofert.png
operator_prep: ./docs/operator/publikacja-ofert-przygotowanie.md
---

# feat: Publikacja ofert

## Przegląd

Handlowiec publikuje ofertę jednym przyciskiem, a klient widzi ją pod stałym adresem. Zmiana dotyczy statusu oferty
w bazie, serwisu zapisu i przycisku na liście ofert.

Drugi akapit przeglądu nie trafia do pliku planu zadania.

## Śledzenie wymagań

- R1. Oferta ma status `szkic` albo `opublikowana`.
- R2. Publikacja jest dostępna z listy ofert.

## Granice scope'u

- Bez wersjonowania opublikowanych ofert.

## Kluczowe decyzje techniczne

- D1: status jako kolumna z ograniczeniem CHECK, nie osobna tabela.

## Rejestr stałych

| Stała | Wartość | Źródło | Konsumenci |
|---|---|---|---|
| `STATUSY_OFERTY` | `szkic`, `opublikowana` | `src/services/oferty-statusy.ts` | IU-1, IU-2 |

## Wymagania wstępne operatora

- [ ] Klucz mapy w `.env.local` — **[blokuje: faza 2]** (IU-2)

## Implementation Units

### Faza 1 — Status i zapis

**Zależy od:** Brak
**Równolegle z:** — *(opcjonalne)*

- [ ] **IU-1: Status oferty i serwis publikacji**

**Cel:** Kolumna statusu i funkcja publikacji w serwisie.

**Wymagania:** R1

**Zależności:** Brak

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `supabase/migrations/20261007120000_status_oferty.sql` | 0 → 25 | — | nowy |
| Stwórz | `src/services/oferty-statusy.ts` | 0 → 15 | — | nowy |
| Modyfikuj | `src/services/oferty-service.ts` | 12 → 60 | — | zostaje |
| Test (unit) | `src/services/oferty-service.test.ts` | 0 → 80 | — | nowy |
| Stwórz (e2e seed) | `e2e/seeds/publikacja-oferty-seed.sql` | 0 → 30 | — | nowy |

**Delegate to:** feature-builder-data

**Skills in play:** supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- Publikacja zmienia status w jednej instrukcji UPDATE z warunkiem na właściciela (D1: status jako kolumna z ograniczeniem CHECK).

**Wzorce do naśladowania:**
- `src/services/klienci-service.ts`

**Scenariusze testowe:**
- [Unit] publikacja szkicu zwraca ofertę ze statusem `opublikowana`
- [Unit] publikacja cudzej oferty zwraca błąd uprawnień

**Weryfikacja:**
- `pnpm typecheck` przechodzi bez błędów

### Faza 2 — Przycisk na liście

**Zależy od:** Faza 1

- [ ] **IU-2: Przycisk publikacji na liście ofert**

**Cel:** Przycisk „Publikuj” przy szkicu na liście ofert.

**Wymagania:** R2

**Zależności:** IU-1

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Modyfikuj | `src/features/oferty/components/lista-ofert.tsx` | 8 → 40 | — | zostaje |
| Test (unit) | `src/features/oferty/components/lista-ofert.test.tsx` | 0 → 50 | — | nowy |

**Delegate to:** feature-builder-ui

**Skills in play:** tailwind-react-guidelines, ux-ui-guidelines

**Podejście:**
- Przycisk wywołuje hook mutacji z IU-1.

**Teksty (verbatim):**
- Przycisk: „Publikuj”

**Scenariusze testowe:**
- [Unit] przycisk „Publikuj” jest tylko przy szkicu
- [E2E] `publikacja-oferty` (seed: e2e/seeds/publikacja-oferty-seed.sql) — otwórz /oferty, kliknij „Publikuj” przy szkicu, zrób screenshot → oferta ma status „opublikowana”
- [Manual] przycisk na fizycznym telefonie ma wygodny cel dotyku

**Weryfikacja:**
- `pnpm vitest run src/features/oferty` przechodzi
- [E2E] `e2e/run-all.sh` — wszystkie flow zielone

**Operator checklist:**
- [ ] Projektant akceptuje wygląd przycisku na liście

- [ ] **IU-3: Adres publiczny oferty**

**Cel:** Strona publiczna opublikowanej oferty.

**Wymagania:** R1, R2

**Zależności:** IU-1

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `src/pages/oferta-publiczna.tsx` | 0 → 90 | — | nowy |
| Stwórz | `src/hooks/use-oferta-publiczna.ts` | 0 → 40 | — | nowy |
| Test (unit) | `src/hooks/use-oferta-publiczna.test.ts` | 0 → 60 | — | nowy |

**Delegate to:** feature-builder-fullstack

**Podejście:**
- Strona czyta ofertę przez hook, szkic zwraca 404.

**Scenariusze testowe:**
- [Unit] hook dla szkicu zwraca brak oferty
- [E2E] `oferta-publiczna` (seed: e2e/seeds/publikacja-oferty-seed.sql) — otwórz /o/<id opublikowanej>, zrób screenshot → widać tytuł oferty

**Weryfikacja:**
- `pnpm typecheck` przechodzi bez błędów

## Ryzyka i zależności

- Brak.

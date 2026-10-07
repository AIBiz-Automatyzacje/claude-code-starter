# Szablon planu technicznego

Plan ma frontmatter i sekcje poniżej. Sekcje opcjonalne pomijasz, gdy nic nie wnoszą (zwłaszcza w planie Lekkim). Format IU, faz i tabeli plików jest kontraktem skryptu `.claude/scripts/plan/plan.mjs` — `sprawdz` odrzuca plan, który od niego odbiega, a `generuj` buduje z niego zadanie dla autopilota.

## Sekcje

| Sekcja | Zawartość | Kiedy |
|---|---|---|
| frontmatter | `title`, `type`, `status: active`, `date`, `origin`, `design_md`, `figma_spec`, `figma_screens`, `operator_prep` | zawsze; cztery ostatnie jako ścieżka albo `null` / `{}` |
| `## Przegląd` | co się zmienia i dlaczego; pierwszy akapit trafia do celu zadania | zawsze |
| `## Ujęcie problemu` | problem użytkownika lub biznesu, odwołanie do źródła | zawsze |
| `## Śledzenie wymagań` | lista `- R1. …` | zawsze |
| `## Granice zakresu` | jawne non-goals i wykluczenia | zawsze |
| `## Kontekst i research` | `### Relevantny kod i wzorce`, `### Wiedza instytucjonalna`, `### Referencje zewnętrzne` | zawsze (puste podsekcje pomiń) |
| `## Kluczowe decyzje techniczne` | `- <decyzja>: <uzasadnienie>` | zawsze |
| `## Rejestr stałych` | tabela stałych współdzielonych albo „Brak stałych współdzielonych.” | zawsze |
| `## Otwarte pytania` | `### Rozwiązane podczas planowania`, `### Odroczone do implementacji` | zawsze |
| `## Wymagania wstępne operatora` | „Brak — autopilot może startować od razu.” albo zdanie z linkiem do checklisty i lista `- [ ] … — **[blokuje: faza N]** (IU-K)` | zawsze |
| `## Implementation Units` | fazy i IU (przykład niżej) | zawsze |
| `## Wpływ systemowy` | graf interakcji, propagacja błędów, cykl życia stanu, parytet API, pokrycie integracyjne | Standardowa, Głęboka |
| `## Ryzyka i zależności` | ryzyka, zależności, kolejność | Standardowa, Głęboka |
| `## Dokumentacja / Notatki operacyjne` | docs, rollout, monitoring | gdy dotyczy |
| `## Źródła i referencje` | dokument źródłowy, powiązany kod, PR, docs zewnętrzne | zawsze |
| `## Rozważane alternatywy`, `## Metryki sukcesu`, `## Zależności techniczne`, `## Analiza ryzyk i mitygacja`, `## Plan dokumentacji`, `## Notatki operacyjne / rolloutowe` | rozszerzenia analizy | Głęboka, gdy realnie pomagają |

`## Zależności techniczne` to biblioteki, wersje i kolejność merge'ów; czynności człowieka należą do „Wymagania wstępne operatora”.

## Pola IU

| Pole | Zapis | Uwagi |
|---|---|---|
| nagłówek | `- [ ] **IU-K: <nazwa>**` pod nagłówkiem fazy | numeracja ciągła przez plan |
| `**Cel:**` | jedno zdanie | |
| `**Wymagania:**` | ID z „Śledzenie wymagań” | |
| `**Zależności:**` | `Brak`, `IU-K` albo zewnętrzny warunek | |
| `**Pliki:**` | tabela `\| Akcja \| Plik \| Linie dziś → po \| Wymiary \| Werdykt \|` | jeden plik na wiersz; akcje `Stwórz`, `Modyfikuj`, `Test (unit)`, `Stwórz (e2e seed)` |
| `**Delegate to:**` | `feature-builder-ui` \| `feature-builder-data` \| `feature-builder-fullstack` | bazowe nazwy |
| `**Skills in play:**` | `skills:` buildera | dokumentacyjne |
| `**Podejście:**` | lista decyzji; odwołanie do decyzji z jej treścią w nawiasie | |
| `**Notatka wykonawcza:**` | jedno zdanie (test-first, characterization-first) | opcjonalne |
| `**Teksty (verbatim):**` | etykiety i komunikaty dosłownie | gdy IU renderuje zatwierdzone treści |
| `**Wzorce do naśladowania:**` | ścieżki istniejącego kodu | |
| `**Scenariusze testowe:**` | `- [Unit] …`, `- [E2E] \`<flow>\` … → …`, `- [Manual] …` | typ na początku każdej pozycji |
| `**Weryfikacja:**` | `- <komenda w backtickach> <oczekiwany wynik>`; `- [E2E] \`e2e/<runner>.sh\` — <stan>` dla runnera niebędącego scenariuszem | |
| `**Operator checklist:**` | `- [ ] <krok człowieka po implementacji>` | opcjonalne |

Kolumna „Linie dziś → po” to dwie liczby całkowite ze strzałką (`285 → 260`); plik spoza kodu może mieć `— → —`. Listy pól zaczynają się od `- ` w kolumnie 0; kontynuacja pozycji jest wcięta. Lista wcięta, numerowana, z `*` albo pole drugi raz w tej samej IU — `sprawdz` zgłasza jako błąd z numerem linii.

## Przykład planu

Plan Lekki z dwiema fazami (dla pokazania przejścia faz) — format, który przechodzi `plan.mjs sprawdz` w projekcie z plikami z kolumny „Modyfikuj” i z `.env.e2e`.

```markdown
---
title: "feat: Notatki do klienta"
type: feat
status: active
date: YYYY-MM-DD
origin: docs/brainstorms/YYYY-MM-DD-notatki-klienta-requirements.md
design_md: ./docs/DESIGN.md
figma_spec: null
figma_screens: {}
operator_prep: null
---

# feat: Notatki do klienta

## Przegląd

Handlowiec dopisuje krótką notatkę do karty klienta i widzi listę notatek od najnowszej. Zmiana obejmuje tabelę notatek,
serwis zapisu i sekcję notatek na karcie klienta.

## Ujęcie problemu

Ustalenia z rozmów z klientem giną w mailach (zob. źródło: docs/brainstorms/YYYY-MM-DD-notatki-klienta-requirements.md).

## Śledzenie wymagań

- R1. Notatka ma autora i niepustą treść z limitem 500 znaków.
- R2. Karta klienta pokazuje notatki od najnowszej.

## Granice zakresu

- Bez edycji i usuwania notatek.

## Kontekst i research

### Relevantny kod i wzorce

- `src/services/klienci-service.ts` — wzorzec serwisu z walidacją zod.

### Wiedza instytucjonalna

- Reguła indeksu „walidacja-wejscia” dla `src/services/**`: walidacja zod na granicy serwisu.

## Kluczowe decyzje techniczne

- Limit treści jako stała współdzielona: walidacja w serwisie i licznik w formularzu muszą mieć tę samą wartość.

## Rejestr stałych

| Stała | Wartość | Źródło | Konsumenci |
|---|---|---|---|
| `MAKS_DLUGOSC_NOTATKI` | `500` | `src/services/notatki-limity.ts` | IU-1, IU-2 |

## Otwarte pytania

### Rozwiązane podczas planowania

- Sortowanie: po `created_at` malejąco, w zapytaniu, nie w komponencie.

### Odroczone do implementacji

- Nazwa indeksu bazy dla `(klient_id, created_at)` — wynika z konwencji migracji przy pisaniu.

## Wymagania wstępne operatora

Brak — autopilot może startować od razu.

## Implementation Units

### Faza 1 — Dane notatek

**Zależy od:** Brak

- [ ] **IU-1: Tabela i serwis notatek**

**Cel:** Tabela notatek z RLS i serwis zapisu oraz listy notatek klienta.

**Wymagania:** R1, R2

**Zależności:** Brak

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `supabase/migrations/YYYYMMDDHHMMSS_notatki_klienta.sql` | 0 → 30 | — | nowy |
| Stwórz | `src/services/notatki-limity.ts` | 0 → 3 | — | nowy |
| Stwórz | `src/services/notatki-service.ts` | 0 → 70 | — | nowy |
| Test (unit) | `src/services/notatki-service.test.ts` | 0 → 90 | — | nowy |

**Delegate to:** feature-builder-data

**Skills in play:** supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- Walidacja zod na granicy serwisu z limitem z rejestru stałych: `MAKS_DLUGOSC_NOTATKI = 500` w `src/services/notatki-limity.ts` (to źródło stałej).
- Lista sortowana w zapytaniu (decyzja z „Rozwiązane podczas planowania”: po `created_at` malejąco, nie w komponencie).

**Wzorce do naśladowania:**
- `src/services/klienci-service.ts`

**Scenariusze testowe:**
- [Unit] notatka o długości limitu zapisuje się, o jeden znak dłuższa zwraca błąd walidacji
- [Unit] lista zwraca notatki klienta od najnowszej

**Weryfikacja:**
- `pnpm vitest run src/services/notatki-service.test.ts` przechodzi
- `pnpm typecheck` przechodzi bez błędów

### Faza 2 — Notatki na karcie klienta

**Zależy od:** Faza 1

- [ ] **IU-2: Sekcja notatek na karcie klienta**

**Cel:** Formularz notatki i lista notatek na karcie klienta.

**Wymagania:** R1, R2

**Zależności:** IU-1

**Pliki:**

| Akcja | Plik | Linie dziś → po | Wymiary | Werdykt |
|---|---|---|---|---|
| Stwórz | `src/features/klienci/components/notatki-klienta.tsx` | 0 → 110 | — | nowy |
| Modyfikuj | `src/features/klienci/components/karta-klienta.tsx` | 285 → 260 | bez wydzielenia 320; powody zmiany: 3 (dane klienta, kontakt, notatki); eksporty 1; importy z 2 domen; test-lustro tak; reguła 5 s nie | wydziel sekcję kontaktu do `kontakt-klienta.tsx` |
| Stwórz | `src/features/klienci/components/kontakt-klienta.tsx` | 0 → 60 | — | nowy |
| Test (unit) | `src/features/klienci/components/notatki-klienta.test.tsx` | 0 → 80 | — | nowy |
| Stwórz (e2e seed) | `e2e/seeds/notatki-klienta-seed.sql` | 0 → 25 | — | nowy |

**Delegate to:** feature-builder-fullstack

**Skills in play:** tailwind-react-guidelines, ux-ui-guidelines, supabase-dev-guidelines, security, sentry-integration

**Podejście:**
- Licznik znaków w formularzu importuje `MAKS_DLUGOSC_NOTATKI` (= 500) z `src/services/notatki-limity.ts` (rejestr stałych).
- Sekcja kontaktu wychodzi z karty klienta przed dodaniem notatek (werdykt tabeli plików), karta po zmianie ma ok. 260 linii (bez wydzielenia 320).

**Teksty (verbatim):**
- Nagłówek sekcji: „Notatki”
- Przycisk: „Dodaj notatkę”
- Pusta lista: „Brak notatek — dodaj pierwszą po rozmowie z klientem.”

**Wzorce do naśladowania:**
- `src/features/klienci/components/karta-klienta.tsx`

**Scenariusze testowe:**
- [Unit] przycisk „Dodaj notatkę” jest nieaktywny przy pustej treści
- [E2E] `notatki-klienta` (seed: e2e/seeds/notatki-klienta-seed.sql) — otwórz /klienci/<id klienta z seeda>, wpisz notatkę, kliknij „Dodaj notatkę”, zrób screenshot → notatka jest pierwsza na liście

**Weryfikacja:**
- `pnpm vitest run src/features/klienci` przechodzi

**Operator checklist:**
- [ ] Handlowiec akceptuje wygląd sekcji notatek na telefonie

## Źródła i referencje

- **Dokument źródłowy:** docs/brainstorms/YYYY-MM-DD-notatki-klienta-requirements.md
- Powiązany kod: `src/services/klienci-service.ts`
```

W przykładzie: plik `karta-klienta.tsx` bez wydzielenia przekroczyłby 300 linii, więc ma ocenione wymiary; pęknięta reguła 5 s daje werdykt `wydziel` z wierszem `Stwórz` nowego modułu, a „po” jest liczone po wydzieleniu. Seed `notatki-klienta-seed.sql` powstaje w tej samej IU co scenariusz, który go używa.

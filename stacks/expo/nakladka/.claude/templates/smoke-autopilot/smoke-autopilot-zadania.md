# Zadania: smoke-autopilot

Branch: `feature/smoke-autopilot`
Ostatnia aktualizacja: 2026-11-07
Plan techniczny: `docs/plans/plan-techniczny-smoke-autopilot.md`

Checkboxy odsyłają do jednostek planu technicznego (IU-K): cel, podejście, decyzje i teksty są tylko tam.

## Faza 1 — Funkcja pomocnicza

Zależy od: Brak

### IU-1: dodajBezpiecznie (feature-builder-data)

- [ ] Stwórz: `{{KATALOG_KODU}}/smoke-autopilot.ts`
- [ ] Test (unit): `{{KATALOG_KODU}}/smoke-autopilot.test.ts`
- [ ] Modyfikuj: `{{MIGRACJA}}`
- [ ] Test: [Unit] happy path: wynik `dodajBezpiecznie(2, 3)` jest liczbą — `expect(typeof dodajBezpiecznie(2, 3)).toBe('number')`
- [ ] Test: [Unit] `dodajBezpiecznie(NaN, 1)` rzuca TypeError
- [ ] Test: [Unit] `dodajBezpiecznie(Infinity, 1)` rzuca TypeError
- [ ] Test: [Unit] `parsujLiczbe('7')` zwraca 7
- [ ] Weryfikacja: `npx tsc --noEmit` przechodzi bez nowych błędów

### IU-2: linie na ekranie głównym (feature-builder-ui)

- [ ] Modyfikuj: `{{EKRAN_GLOWNY}}`
- [ ] Stwórz (e2e flow): `.maestro/smoke-strona.yaml`
- [ ] Test: [E2E] `smoke-strona` — stopApp, openLink do dev-clienta, assertVisible „Smoke autopilot”, takeScreenshot → widoczny nagłówek i tekst „dodajBezpiecznie(2, 3) = 5”

## Operator checklist faza 1

- [ ] [Manual] wywołaj `dodajBezpiecznie(NaN, 1)` w konsoli dev-clienta i sprawdź, że komunikat TypeError jest czytelny dla człowieka (IU-1)

## Faza 2 — Druga linia ekranu

Zależy od: Faza 1

### IU-3: linia fazy 2 (feature-builder-ui)

- [ ] Modyfikuj: `{{EKRAN_GLOWNY}}`
- [ ] Stwórz (e2e flow): `.maestro/smoke-strona-faza-2.yaml`
- [ ] Test: [E2E] `smoke-strona-faza-2` — stopApp, openLink do dev-clienta, assertVisible „Faza 2: gotowe”, takeScreenshot → widoczny tekst „Faza 2: gotowe” pod wynikiem przykładu

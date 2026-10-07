# Plan: smoke-autopilot

Branch: `feature/smoke-autopilot`
Ostatnia aktualizacja: 2026-10-07
Plan techniczny: `docs/plans/plan-techniczny-smoke-autopilot.md`

## Źródła

- Plan techniczny: `docs/plans/plan-techniczny-smoke-autopilot.md`
- Requirements doc: brak
- Przygotowanie dla operatora: brak

## Cel

Zadanie-atrapa do smoke-testu pipeline'u dev-autopilot-wf: jedna czysta funkcja pomocnicza z testami i celowymi defektami dla review, fixa i bramek domknięcia. Wartość biznesowa zerowa, diagnostyczna — cała.

## Zakres

Wymagania i granice: `docs/plans/plan-techniczny-smoke-autopilot.md`, sekcje „Śledzenie wymagań” i „Granice zakresu”.

## Fazy

| Faza | Nazwa | IU | Zależy od | Delegaci |
|---|---|---|---|---|
| 1 | Funkcja pomocnicza | IU-1 | Brak | feature-builder-data |

## Kryteria akceptacji całości

Każda faza: typecheck 0 błędów, testy PASS, review bez otwartych P1; każdy `[E2E]` uruchomiony (nie odhaczony ręcznie).
Kryteria zadania: `docs/plans/plan-techniczny-smoke-autopilot.md`, sekcja „Śledzenie wymagań” (i „Metryki sukcesu”, gdy plan ją ma).

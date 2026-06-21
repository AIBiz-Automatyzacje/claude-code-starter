# Plan: smoke-autopilot

Branch: (dowolny — brak wymaganego brancha)
Plan techniczny: docs/plans/plan-techniczny-smoke-autopilot.md

## Cel

Trywialne zadanie-atrapa do smoke-testu pipeline'u dev-autopilot-wf. Dostarcza jedna czysta
funkcje pomocnicza z testami. Wartosc biznesowa: zerowa. Wartosc diagnostyczna: cala.

## Fazy

### Faza 1: Funkcja pomocnicza

Jedna funkcja `dodajBezpiecznie` w `src/lib/smoke-autopilot.ts` (walidacja wejscia + suma) wraz z testami
(happy path + error case). Brak UI, brak bazy, brak zaleznosci zewnetrznych.

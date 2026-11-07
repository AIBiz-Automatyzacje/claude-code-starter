# dev-prep — fragmenty stacku Expo (React Native + Expo Router)

Slot stackowy skilla (rejestr: `stacks/sloty.json`). Ścieżki i pola checklisty, które zależą od stacku; klasyfikacja
UI / pure-data idzie za `.claude/stack/buildery.md`, sekcja „Ścieżki warstw”.

## Skan repo

| Co sprawdzasz | Gdzie |
|---|---|
| Istniejące trasy i ekrany | `src/app/` albo `app/`, `src/features/*/` |
| Assety | `assets/`, ikona i splash w `app.json` |

## Serwer API w E2E

- Backend to zwykle Supabase, więc wystarcza Metro. Scenariusz przez własny serwer API: `E2E_START` musi uruchamiać ten serwer i Metro.

## Makiety

- Pole wymiarów ekranu: **Wymiar frame'a**; w szablonie checklisty „Wymiar frame'a: 393×852”. Typowe wymiary: 393×852 (iPhone 14 i 15), 390×844 (iPhone 12 i 13), 360×800 (Android).
- `SPEC.md` ma kolumnę `Target device` z urządzeniem makiety, a pomiary uwzględniają safe area, pasek stanu i wskaźnik home.
- Ścieżka ekranu przy statusie „modyfikacja”: `src/app/<x>.tsx` albo `app/<x>.tsx`.

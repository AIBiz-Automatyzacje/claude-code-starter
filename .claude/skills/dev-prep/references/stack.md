# dev-prep — fragmenty stacku web (React + Vite)

Slot stackowy skilla (rejestr: `stacks/sloty.json`). Ścieżki i pola checklisty, które zależą od stacku; klasyfikacja
UI / pure-data idzie za `.claude/stack/buildery.md`, sekcja „Ścieżki warstw”.

## Skan repo

| Co sprawdzasz | Gdzie |
|---|---|
| Istniejące route'y / strony | `src/pages/`, `src/features/*/`, router |
| Assety | `public/`, `src/assets/` |

## Serwer API w E2E

- `E2E_START` musi uruchamiać serwer i Vite z proxy.

## Makiety

- Pole wymiarów ekranu: **Breakpointy**; w szablonie checklisty „Breakpointy: mobile + desktop”.
- Ścieżka ekranu przy statusie „modyfikacja”: `src/pages/<x>.tsx`.

# Buildery i warstwy — stack web (React + Vite + Supabase)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń odsyła tu po routing jednostek do builderów i ścieżki warstw.
Nazwy ról (`feature-builder-ui`, `feature-builder-data`, `feature-builder-fullstack`) są wspólne dla wszystkich stacków.

## Tabela builderów

`Delegate to:` = builder z `.claude/agents/`, dobrany po ścieżkach tabeli plików:

| Pliki IU | Delegate to | Skills in play |
|---|---|---|
| tylko UI: `*.tsx` w `src/components/`, `src/features/<x>/components/`, `src/pages/`, `*.css` | `feature-builder-ui` | tailwind-react-guidelines, ux-ui-guidelines |
| tylko dane: `src/lib/`, hooki danych, `src/services/`, `supabase/migrations/`, `supabase/functions/` | `feature-builder-data` | supabase-dev-guidelines, security, sentry-integration |
| UI i dane w jednej atomowej IU | `feature-builder-fullstack` | tailwind-react-guidelines, ux-ui-guidelines, supabase-dev-guidelines, security, sentry-integration |

## Ścieżki warstw

- UI: ekrany, komponenty, layouty, nawigacja, animacje i stany widoczne dla użytkownika — pliki w `src/components/`,
  `src/features/`, `src/pages/`, `*.css`.
- Dane (pure-data): `src/lib/`, `src/hooks/`, `supabase/`, testy i konfiguracja.
- Flaga warstwy prezentacji w review fazy: komponenty, style, HTML, szablony, `public/`.
- Stała czytana przez serwer i klienta (rejestr stałych planu): moduł bez Reacta (`src/config/…`, `src/lib/…`),
  nie `src/components/`, `src/pages/` ani `src/hooks/`.

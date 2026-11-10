# Buildery i warstwy — stack Expo (React Native + Expo Router + Supabase)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń odsyła tu po routing jednostek do builderów i ścieżki warstw.
Nazwy ról (`feature-builder-ui`, `feature-builder-data`, `feature-builder-fullstack`) są wspólne dla wszystkich stacków.

Układ szablonu SDK 58 trzyma kod w `src/` (`src/app`, `src/components`, `src/hooks`). Projekt bez `src/` ma te same katalogi w korzeniu.

## Tabela builderów

`Delegate to:` = builder z `.claude/agents/`, dobrany po ścieżkach tabeli plików:

| Pliki IU | Delegate to | Skills in play |
|---|---|---|
| tylko UI: `*.tsx` w `src/app/` albo `app/`, `src/components/`, `src/features/<x>/components/`, `*.css`, `app.json`, `app.config.*`, `assets/` | `feature-builder-ui` | rn-expo-guidelines, ux-ui-guidelines-mobile, uniwind |
| tylko dane: `src/lib/` albo `lib/`, hooki danych, `src/services/`, `supabase/migrations/`, `supabase/functions/` | `feature-builder-data` | supabase-dev-guidelines, security, sentry-integration |
| UI i dane w jednej atomowej IU | `feature-builder-fullstack` | rn-expo-guidelines, ux-ui-guidelines-mobile, uniwind, supabase-dev-guidelines, security, sentry-integration |

Skille `expo:*` z pluginu builder ładuje narzędziem `Skill`, gdy są potrzebne, więc nie ma ich w `Skills in play`.

Skill `supabase-dev-guidelines` ładuje się z frontmattera roli w każdym projekcie. Gdy projekt nie używa Supabase, builder pomija komendy i wzorce Supabase z tego skilla, a migracje i dostęp do danych robi narzędziami projektu (z planu i `CLAUDE.md`).

## Ścieżki warstw

- UI: ekrany, komponenty, layouty, nawigacja, animacje i stany widoczne dla użytkownika — pliki w `src/app/` albo `app/`,
  `src/components/`, `src/features/`, `*.css`, `assets/`, a także `app.json` i `app.config.*` przy ikonie, splashu i wyglądzie.
- Dane (pure-data): `src/lib/` albo `lib/`, `src/hooks/`, `src/services/`, `supabase/`, testy i konfiguracja.
- Flaga warstwy prezentacji w review fazy: komponenty RN, trasy Expo Router, style Uniwind, assety.
- Stała czytana przez serwer i klienta (rejestr stałych planu): moduł bez Reacta (`src/config/…`, `src/lib/…`),
  nie `src/app/`, `src/components/` ani `src/hooks/`.

## Instalacja zależności

Paczki SDK instalujesz przez `npx expo install <paczka>` (`.claude/rules/stack.md`, sekcja „Zależności”). Paczka z kodem natywnym
unieważnia dev-clienta: `.claude/stack/po-fazie.md`, sekcja „Przebudowa”.

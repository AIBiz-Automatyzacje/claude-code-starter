# Bloki per stack — path_filters + path_instructions

Dokładaj do `coderabbit-base.yaml` bloki pasujące do wykrytego stacku.
Dodawaj **tylko** wpisy dla katalogów, które realnie istnieją (lub — jak przy
świeżym Expo — pojawią się po init; wtedy zostaw komentarz, jak w bloku Expo).

## Expo / React Native

Sygnały: `expo` w dependencies, katalog `app/` z Expo Router, `app.json`/`app.config.ts`.

```yaml
# path_filters — dopisz:
    - "!assets/**"
    - "!ios/**"
    - "!android/**"
    - "!.expo/**"

# path_instructions — dopisz:
    - path: "app/**/*.tsx"
      instructions: |
        Ekrany Expo Router. Jedna odpowiedzialność per plik — logikę
        biznesową wyciągaj do hooków/services, plik z ekranem zawiera
        głównie strukturę UI.
    - path: "components/**/*.tsx"
      instructions: |
        Komponenty React Native. Mały, jeden export per plik. Używaj
        NativeWind (className) zamiast StyleSheet gdzie się da. Każdy
        interaktywny element ma accessibilityLabel.
```

## Next.js

Sygnały: `next` w dependencies, katalog `app/` lub `pages/`, `next.config.*`.

```yaml
# path_filters — dopisz:
    - "!.next/**"
    - "!public/**"

# path_instructions — dopisz:
    - path: "app/**/*.tsx"
      instructions: |
        App Router. Server Components domyślnie — `"use client"` tylko gdy
        potrzebne (stan, event handlers, browser API). Logikę biznesową
        wyciągaj do services/hooków, plik strony to głównie struktura UI.
    - path: "components/**/*.tsx"
      instructions: |
        Komponenty React. Mały, jeden export per plik. Tailwind zamiast
        inline styles. Każdy interaktywny element dostępny z klawiatury
        (focus-visible, aria-label gdzie brak tekstu).
```

## React web (Vite)

Sygnały: `vite` w devDependencies + `react` w dependencies, katalog `src/`.

```yaml
# path_filters — dopisz:
    - "!dist/**"
    - "!public/**"

# path_instructions — dopisz:
    - path: "src/pages/**/*.tsx"
      instructions: |
        Strony/widoki. Jedna odpowiedzialność per plik — logikę biznesową
        wyciągaj do hooków/services, plik strony zawiera głównie strukturę UI.
    - path: "src/components/**/*.tsx"
      instructions: |
        Komponenty React. Mały, jeden export per plik. Tailwind (className)
        zamiast inline styles. Każdy interaktywny element dostępny
        z klawiatury (focus-visible, aria-label gdzie brak tekstu).
```

## Node backend

Sygnały: brak frameworka frontowego, `express`/`fastify`/`hono` w dependencies
albo czysty serwis TS/JS.

```yaml
# path_filters — dopisz:
    - "!dist/**"
    - "!build/**"

# path_instructions — dopisz:
    - path: "src/routes/**/*.ts"
      instructions: |
        API routes: waliduj KAŻDY input na granicy (Zod). Ustandaryzowany
        format odpowiedzi { data, error: { code, message } }. Rate limiting
        na publicznych endpointach. Parametrized queries — zero konkatenacji
        user input do SQL.
    - path: "src/services/**/*.ts"
      instructions: |
        Logika biznesowa. Typed errors (AppError), nie string messages.
        Structured logging (pino), nie console.log. Fail fast — walidacja
        inputów na początku funkcji.
```

## Supabase (Edge Functions + migracje)

Sygnały: katalog `supabase/`, `@supabase/supabase-js` w dependencies.
Łączy się z dowolnym blokiem frontowym powyżej.

```yaml
# path_instructions — dopisz:
    - path: "supabase/functions/**/*.ts"
      instructions: |
        Edge Functions (Deno). Waliduj input Zod-em na wejściu. Autoryzacja
        NIGDY po user_metadata (edytowalne przez usera) — rola z app_metadata
        lub dedykowanej tabeli. Nie loguj secrets ani danych osobowych.
    - path: "supabase/migrations/**/*.sql"
      instructions: |
        Migracje: każda nowa tabela ma RLS enabled + policies. Funkcje SQL
        z `security definer` ustawiają `search_path = ''`. Indeksy dla
        kolumn używanych w RLS policies i częstych filtrach.
```

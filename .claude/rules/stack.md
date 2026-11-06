---
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs}"
  - "**/*.sql"
---

# Reguły stacku: React DOM + Vite

Mechanizmy stacku do reguł z `.claude/rules/coding-rules.md`; sekcje mają te same nazwy. Przy sprzeczności w kodzie aplikacji wygrywa ten plik.

## Testowanie

- Komponent testujesz przez Testing Library, gdy projekt ją ma. Brak biblioteki w `package.json` nie jest błędem kodu: dodanie jej to decyzja operatora, a test render serwerowy albo DOM wystarcza do tego czasu.

## Organizacja kodu

- Testy leżą obok plików źródłowych.

## Zależności

- Wersje w package.json przypinasz dokładnie.

## Bezpieczeństwo

- Konfigurację lokalną albo e2e, w której kod przyjmuje klucz testowy dostawcy, rozpoznajesz warunkiem z trybu aplikacji albo `SITE_URL`.

## Type safety

- Poza `as const` dopuszczasz `as` tylko przy zawężaniu DOM.

## Performance

- Po dodaniu zależności w kodzie klienta budżet paczki pilnuje size-limit w domknięciu.
- Komponent większy niż 50 KB ładujesz dynamicznie (`React.lazy`, dynamic import).

## Async i React

- Limit czasu wywołania sieciowego daje `AbortSignal.timeout`.
- Włączony React Compiler rozpoznajesz po `babel-plugin-react-compiler` w projekcie.

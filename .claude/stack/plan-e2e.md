# Scenariusze E2E w planie — stack web (Vite + agent-browser)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń planowania (`/dev-plan` §3.4b i bramka 6.1) odsyła tu po to, jak
w tym stacku wygląda linia scenariusza, gdzie leżą seedy i czego narzędzie jazdy nie wykona. Zasady wspólne
(idempotentny seed, smoke RLS SQL-em, limity maili, projekt bez `.env.e2e`) są w rdzeniu.

## Linia scenariusza

- Scenariusz: `- [E2E] \`<flow>\`[ (seed: e2e/seeds/<x>-seed.sql)] — <otwórz URL, kliknij X, sprawdź Y, screenshot> → <oczekiwany stan>`;
  `<flow>` to stabilny kebab-case identyfikator. Tester wykonuje scenariusz z opisu linii, plików flow nie ma.
- `Weryfikacja: [E2E]` tylko dla runnera `.sh`, który nie jest scenariuszem (np. `e2e/run-all.sh`).

## Seedy

- Seed jest deliverablem buildera: dane spoza stanu bazowego konta `E2E_TEST_EMAIL` i spoza istniejących seedów →
  wiersz `Stwórz (e2e seed)` z `e2e/seeds/<flow>-seed.sql` w tabeli plików IU; dane z istniejącego seeda → jego ścieżka
  w linii scenariusza (`(seed: e2e/seeds/<x>-seed.sql)`).

## Granice narzędzia jazdy

- Natywne okno albo zewnętrzny system (systemowy file picker i upload, popup OAuth, zewnętrzne okno płatności, captcha,
  odebranie e-maila) — agent-browser tego nie wykona i scenariusz spadnie do operatora. Dane, które przyszłyby przez
  upload albo zewnętrzny system, wstrzykujesz seedem albo `service_role` na bazie e2e i asertujesz render; logowanie
  zawsze e-mailem i hasłem konta `E2E_TEST_EMAIL`; krok nie do obejścia → `[Manual]` w Operator checklist IU.

## Serwer aplikacji w scenariuszu

- Scenariusz, który zapisuje albo czyta przez serwer aplikacji (`fetch('/api/…')`, serwer poza Vite): `E2E_START` musi
  uruchamiać ten serwer, a sonda sprawdzać jego trasę z treścią (`E2E_HEALTH` + `E2E_HEALTH_TRESC`). Sam Vite odpowiada
  na `/api/*` stroną albo 404, a scenariusze idą na `[Manual]`. Brak skryptu startu obu procesów → IU, która go tworzy
  (wzór w `.claude/templates/e2e-env/README.md`, sekcja „Aplikacja z osobnym serwerem API”), w fazie przed pierwszym
  takim scenariuszem, i pozycja checklisty „podmień `E2E_START`, ustaw sondy” z `[blokuje: faza N]`.
- Scenariusz sprawdzający status HTTP albo meta (`<title>`, `og:*`) trasy renderowanej przez serwer odpytuje port
  serwera albo trasę z listy proxy Vite, nigdy port Vite: Vite odpowiada na każdej ścieżce 200 i `index.html`.
  W linii scenariusza podajesz adres (`<E2E_URL>/<trasa z proxy>` albo port serwera).

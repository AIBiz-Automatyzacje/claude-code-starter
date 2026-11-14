# Scenariusze E2E w planie — stack Expo (Maestro)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń planowania (`/dev-plan` §3.4b i bramka 6.1) odsyła tu po to, jak
w tym stacku wygląda linia scenariusza, gdzie leżą seedy i czego narzędzie jazdy nie wykona. Zasady wspólne
(jedna linia na flow, idempotentny seed, smoke RLS SQL-em, limity maili, projekt bez `.env.e2e`) są w rdzeniu.

## Linia scenariusza

- Scenariusz: `- [E2E] \`<flow>\`[ (seed: .maestro/<x>-seed.sql)] — <launchApp, tapOn X, assertVisible Y, takeScreenshot> → <oczekiwany stan>`.
  `<flow>` to identyfikator kebab-case, a plik flow to `.maestro/<flow>.yaml`.
- Plik flow jest deliverablem buildera (D17): tester tylko go uruchamia. W tabeli plików IU stoi wiersz `Stwórz (e2e flow)` z
  `.maestro/<flow>.yaml` albo `Modyfikuj (e2e flow)`, gdy scenariusz rozszerza istniejący flow. `plan.mjs sprawdz` odrzuca `[E2E]`, którego
  pliku nie ma w polu Pliki ani w repo; w runie brak pliku daje SKIP `scenariusz-niewykonalny`.
- `assertVisible` trafia w element widoczny w drzewie dostępności. Tekst wewnątrz kontenera z `accessible` i `accessibilityLabel`
  (karta, wiersz listy) iOS skleja w jeden element, więc Maestro nie widzi tekstu dzieci: scenariusz asertuje wtedy pełną etykietę
  kontenera (np. „Wszystkie check-iny: 3”), a Podejście IU podaje jej brzmienie (pilot mobile, run 6).
- `Weryfikacja: [E2E]` tylko dla runnera `.sh`, który nie jest scenariuszem (np. `.maestro/<etap>-run-all.sh`).

## Seedy

- Seed jest deliverablem buildera: dane spoza stanu bazowego konta `E2E_TEST_EMAIL` i spoza istniejących seedów →
  wiersz `Stwórz (e2e seed)` z `.maestro/<flow>-seed.sql` w tabeli plików IU; dane z istniejącego seeda → jego ścieżka
  w linii scenariusza (`(seed: .maestro/<x>-seed.sql)`).

## Granice narzędzia jazdy

- **Natywna powierzchnia OS albo zewnętrzny system** (picker zdjęć, kamera, picker dokumentów, share sheet, natywny Alert i ActionSheet,
  biometria, sheet OAuth, zewnętrzne okno płatności, odebranie e-maila) — Maestro steruje tylko drzewem dostępności aplikacji, więc tego nie
  wykona i scenariusz spadnie do operatora. Prześledź każdy krok scenariusza. Dane, które przyszłyby tą drogą, wstrzykujesz seedem albo
  `runScript: .maestro/inject-*.js` i asertujesz render; logowanie zawsze e-mailem i hasłem konta `E2E_TEST_EMAIL`; krok nie do obejścia
  → `[Manual]` w Operator checklist IU. Tabela powierzchni i wzorzec: skill `mobile-e2e-maestro`, sekcja „Granica możliwości Maestro”.
- Haptyka, dźwięk, push i dwa urządzenia naraz: `[Manual]` na fizycznym urządzeniu.

## Serwer aplikacji w scenariuszu

- Backend aplikacji to Supabase i Edge Functions, więc zwykle scenariusz potrzebuje tylko Metro, które stawia `e2e.mjs start`.
- Scenariusz, który zapisuje albo czyta przez własny serwer API: `E2E_START` musi uruchamiać ten serwer i Metro, a sonda sprawdzać
  trasę serwera z treścią (`E2E_HEALTH` + `E2E_HEALTH_TRESC`), bo sama odpowiedź Metro nie dowodzi, że serwer działa. Brak skryptu
  startu obu procesów → IU, która go tworzy (wzór w `.claude/templates/e2e-env/README.md`, sekcja „Aplikacja z osobnym serwerem API”), w
  fazie przed pierwszym takim scenariuszem, i pozycja checklisty „podmień `E2E_START`, ustaw sondy” z `[blokuje: faza N]`, gdzie N to
  faza tego scenariusza.
- Maestro nie widzi statusów HTTP. Status i treść odpowiedzi serwera sprawdza test `[Unit]` albo komenda w `Weryfikacja`, a nie scenariusz.

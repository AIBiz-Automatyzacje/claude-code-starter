# Środowisko E2E — stack Expo (Metro, dev-client, Maestro)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń odsyła tu po to, jak stack stawia aplikację do E2E i czym tester
ją prowadzi. Mechanika wspólna (`.env.e2e`, dedykowany projekt Supabase e2e, `supabase db push` migracji i seedów,
konto `E2E_TEST_EMAIL`, polecenia `node .claude/scripts/e2e/e2e.mjs start|restart|manual`) jest w rdzeniu.

## Start aplikacji

- Serwer: Metro. Domyślny `E2E_START` = `env -u CI <pm> expo start --port <port>`. `CI` jest usunięte, bo przy `CI=1` Metro
  nie obserwuje plików i zmiana env nie dociera do paczki. Obcy proces na porcie adapter zatrzymuje (`zastap`, D11): obcy Metro
  może serwować paczkę innego projektu.
- Adres: `E2E_URL`, domyślnie `http://localhost:8081`. Dev-client łączy się z tym portem, więc to ten sam port co zwykłe Metro.
- Zmienne klienta: `e2e.mjs start` zapisuje linie `EXPO_PUBLIC_*` z `.env.e2e` do `.env.development.local` (najwyższy priorytet w
  trybie dev), a `e2e.mjs stop` plik usuwa. `.env.local` zostaje nietknięty. Istniejący plik operatora dostaje kopię
  `.env.kopia-e2e.local` i wraca po `stop`. Pozostawiony plik zgłasza doctor.
- Urządzenie: iOS najpierw, Android jako zapas. Na iOS odpada symulator z zalogowanym kontem Apple, bo monit „Weryfikacja
  konta Apple” zasłania aplikację i nie zamyka się wstrzykniętym dotknięciem. Wybór ręczny: `E2E_PLATFORMA` (`ios`, `android`)
  i `E2E_URZADZENIE` (nazwa albo UDID symulatora, serial `adb`). Android: tylko emulator już działający.
- Dev-client: zmiana natywna po buildzie to STOP z komendą przebudowy (`.claude/stack/po-fazie.md`, sekcja „Przebudowa”). Dev-client iOS
  bez podpisu to też STOP, bo bez podpisu SecureStore nie utrwala sesji.

## Sonda zdrowia

- `E2E_HEALTH` (domyślnie `<E2E_URL>/status`): odpowiedź < 500 = działa. Korzeń `/` każe Expo budować paczkę web, więc sonda
  go nie używa. `E2E_HEALTH_TRESC`: tekst wymagany w odpowiedzi; dla `/status` Metro to `packager-status:running`.
- Aplikacja z osobnym serwerem API: `E2E_START` uruchamia oba procesy (wzór w `.claude/templates/e2e-env/README.md`,
  sekcja „Aplikacja z osobnym serwerem API”).

## Narzędzie jazdy

- Tester `feature-tester-e2e` prowadzi aplikację przez Maestro (skill `mobile-e2e-maestro`): plik flow `.maestro/<flow>.yaml` jest
  częścią dostawy buildera, a tester flow nie pisze.
- Kontrola narzędzia: `maestro --version`, Java 17+ i próbny zrzut ekranu wybranego urządzenia.
- Dowód startu (canary): po odpowiedzi Metro adapter wysyła reload i uruchamia `.maestro/_canary.yaml` z logowaniem i asercją za
  logowaniem. Bez tego pliku idzie tymczasowy flow wejścia w dev-client, a wynik mówi, że to słaby dowód.

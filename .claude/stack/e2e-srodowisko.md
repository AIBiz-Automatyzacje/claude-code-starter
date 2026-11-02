# Środowisko E2E — stack web (Vite + agent-browser)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń odsyła tu po to, jak stack stawia aplikację do E2E i czym tester
ją prowadzi. Mechanika wspólna (`.env.e2e`, dedykowany projekt Supabase e2e, `supabase db push` migracji i seedów,
konto `E2E_TEST_EMAIL`, polecenia `node .claude/scripts/e2e/e2e.mjs start|restart|manual`) jest w rdzeniu.

## Start aplikacji

- Serwer: Vite w trybie `--mode e2e`. Domyślny `E2E_START` = `<pm> run dev -- --mode e2e --port <port> --strictPort`.
- Adres: `E2E_URL`, domyślnie `http://localhost:5174` — obok domyślnego 5173 dev servera Vite, żeby zwykły `pnpm dev`
  nie został wzięty za serwer aplikacji. Port z `--port` w `E2E_START` musi być portem `E2E_URL`.
- Aplikacja z osobnym serwerem API: `E2E_START` uruchamia oba procesy (wzór w `.claude/templates/e2e-env/README.md`,
  sekcja „Aplikacja z osobnym serwerem API”).

## Sonda zdrowia

- `E2E_HEALTH` (domyślnie `E2E_URL`): odpowiedź < 500 = działa.
- `E2E_HEALTH_TRESC`: tekst wymagany w odpowiedzi sondy. Sam Vite odpowiada 200 na każdej ścieżce (fallback SPA,
  `index.html`), więc projekt z serwerem API sprawdza trasę zdrowia serwera z treścią — inaczej start bez serwera
  przechodzi sondę, a zapisy przez `/api` dostają 404. Ścieżka sondy na porcie Vite musi być w trasach proxy Vite.

## Narzędzie jazdy

- Tester `feature-tester-e2e` prowadzi aplikację przez `agent-browser` (open URL, snapshot, click, screenshot);
  scenariusz wykonuje z opisu linii `[E2E]`, plików flow nie ma.
- Kontrola narzędzia: `agent-browser doctor --offline --quick` i próbny zrzut `about:blank` w osobnej sesji.

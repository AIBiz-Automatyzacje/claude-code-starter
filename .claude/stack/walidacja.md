# Walidacja — stack web (Vitest + Vite)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń odsyła tu po wszystko, co w walidacji zależy od runnera testów
i narzędzia builda. Prawa środowiska agenta (watchdog 180 s ciszy, limit 600 s foreground Bash, praca w tle z pollingiem)
są w rdzeniu i obowiązują niezależnie od tego pliku.

## Runner testów i build

- Runner testów: vitest. Komendy bierzesz z `scripts` w `package.json` (typecheck, lint, test, build).
- Krok build: skrypt `build` z `package.json` (zwykle `vite build`); brak skryptu build → build = `n/a`.
- Domknięcie fazy sprawdza, że build (`vite build`) przechodzi.

## Zimny runner

- Zimny vitest po inwalidacji cache (Vite optimizeDeps / zmiana zależności lub configu) potrafi MILCZEĆ przez fazę
  transform/prebundle PRZED pierwszym outputem reportera — cisza to nie zwis; żaden reporter nie pomaga.
- Komendy mogące trwać >100 s: vitest po zmianie zależności/configu, pełny suite, build.
- Po zmianie `package.json` / lockfile / `vite.config` / `vitest.config` przez kogokolwiek w tym runie: pierwszy vitest
  traktuj jako ZIMNY (pełna procedura tła).
- Vitest uruchamiaj z `--reporter=dot`: strumieniowany stdout W TRAKCIE foreground Bash resetuje watchdog, więc chroni
  WARM suite'y w oknie 180–600 s. NIE chroni: zimnego cache (transform milczy do końca) ani komend >600 s.
- Jednostka dodająca nową zależność (biblioteka, config vite/vitest) → strategia serial: równoległe zimne vitesty
  po inwalidacji cache duplikują ~16-min pracę i ryzykują watchdog-kill.

## Flake infrastruktury

Błąd infrastruktury workera w pełnym suicie: `[vitest-worker]: Timeout calling "fetch"`, `Timeout calling`,
`worker terminated`, `ENOMEM`, `heap out of memory`.

## Rozgrzewka cache

Cel: zbudować cache transformacji vitest (`node_modules/.vite` / optimizeDeps) PRZED fazami implementacji.

1. Runner: rozgrzewka dotyczy WYŁĄCZNIE vitest. Brak vitest w `package.json` (inny runner lub brak testów) → rozgrzewka zbędna.
2. Plik: JEDEN test komponentu z najcięższym setupem — `*.test.tsx` importujący komponenty React (`src/components/`,
   `src/features/`, `src/pages/` — transform JSX + jsdom + ciężkie zależności są najdroższe). Bez żadnego testu
   komponentu w repo (projekt greenfield): tymczasowy plik `.autopilot-warmup.test.tsx` w katalogu testowym projektu
   z trywialnym renderem `<div>warmup</div>` (przez `@testing-library/react`) i 1 asercją; usuwasz go po rozgrzewce.
3. Komenda biegu: `<pm> vitest run <plik> --reporter=dot` (pm z lockfile: `bun.lockb`→bunx, pnpm→pnpm, yarn→yarn, npm→npx).

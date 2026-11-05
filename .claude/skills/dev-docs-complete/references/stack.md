# dev-docs-complete — fragmenty stacku web (React + Vite + Tailwind)

Slot stackowy skilla (rejestr: `stacks/sloty.json`). Wstawki do dokumentu smoke'u operatora, które zależą od stacku;
układ dokumentu, źródła pozycji i hierarchia stanu są w SKILL.md.

## Smoke operatora

- Narzędzie jazdy automatu (nagłówek smoke'u): „<M> scenariuszy E2E w przeglądarce”.
- Czego automat nie sprawdzi: wygląd na prawdziwym ekranie, natywne okna przeglądarki (file picker, print, powiadomienia),
  odczucie animacji, responsywność na realnym urządzeniu.
- Klasa błędów niewidocznych w testach (przykład do „Dlaczego to nie jest formalność”): Tailwind cicho ignoruje
  nieistniejące klasy; scroll i overflow zachowują się inaczej na realnym urządzeniu dotykowym niż w emulowanym viewporcie.
- Start aplikacji w sekcji 0: `- [ ] Dev server uruchomiony (\`<pm> run dev\`), aplikacja otwiera się na localhost:5173`.
- Warunek środowiskowy, który nie wchodzi do smoke'u: dev server w trybie `--mode e2e`.

## Punkty wizualne

Punkty wizualne czyta narzędzie makiet (`/makieta`).

- Zdanie przed pierwszym punktem wizualnym smoke'u: „Punkty wizualne przejdziesz narzędziem makiet: w sesji smoke'u wpisz /makieta.”
- Zdanie do ramki „Jak kontynuować w nowej sesji”: „Przy punktach wizualnych uruchom /makieta; przed /clear zatrzymaj narzędzie (makieta.mjs stop).”
- Kontrola po zapisie pliku: `node .claude/scripts/makieta/makieta.mjs sprawdz --smoke <plik> --pola`. Kod 1 = pole problemy (linie spoza
  formatu albo bez PNG makiety) — popraw wskazane linie i uruchom kontrolę jeszcze raz; smoke bez punktów wizualnych daje kod 0.

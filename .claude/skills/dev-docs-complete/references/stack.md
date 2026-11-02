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

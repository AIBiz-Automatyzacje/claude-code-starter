# weryfikacja-setup — fragmenty stacku web (agent-browser)

Slot stackowy skilla (rejestr: `stacks/sloty.json`). Narzędzie jazdy w przejściu na żywo; szkielet skilla weryfikacji
dostaje te same komendy z adaptera E2E (`SZKIELET_WERYFIKACJI` w `.claude/scripts/e2e/adapter.mjs`).

## Przejście na żywo

- Drive: skillem `agent-browser` zaloguj się według sekcji Drive i przejdź drogę jednej funkcji z mapy (najnowszy wpis)
  albo głównego ekranu, gdy mapa jest pusta.
- Evidence: asercja oczekiwanego stanu w snapshotcie i zrzut `agent-browser screenshot /tmp/weryfikacja-setup.png`.
- Cleanup (po `e2e.mjs stop`): `agent-browser close`.

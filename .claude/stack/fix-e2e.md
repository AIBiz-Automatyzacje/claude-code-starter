# Naprawa E2E — stack web (agent-browser)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń odsyła tu po narzędzie jazdy w naprawie findingu E2E. Mechanika
wspólna (odznaczanie checkboxów dopiero po PASS, restart serwera `e2e.mjs start`, przeniesienie flow na ręczne
`e2e.mjs manual`, opis ekranu z katalogu makiet) jest w rdzeniu.

## Ponowne odegranie scenariusza

Po naprawie przyczyny re-uruchom scenariusz w przeglądarce (agent-browser: open URL, snapshot, click, screenshot).

## Sprawdzenie poprawki wizualnej

Poprawkę sprawdzasz w aplikacji bez zrzutu: `agent-browser snapshot -i` (elementy i teksty) i
`agent-browser get box <ref>` / `get styles <ref>` (wymiary, kolory).

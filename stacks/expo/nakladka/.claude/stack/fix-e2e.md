# Naprawa E2E — stack Expo (Maestro)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń odsyła tu po narzędzie jazdy w naprawie findingu E2E. Mechanika
wspólna (odznaczanie checkboxów dopiero po PASS, restart serwera `e2e.mjs start`, przeniesienie flow na ręczne
`e2e.mjs manual`, opis ekranu z katalogu makiet) jest w rdzeniu.

## Ponowne odegranie scenariusza

Gdy finding mówi „brak flow”, najpierw piszesz `.maestro/<flow>.yaml` wg pola Pliki i scenariusza IU. Po naprawie przyczyny
uruchamiasz scenariusz na urządzeniu: `node .claude/scripts/e2e/expo-flow.mjs --zadanie <folder> --flow <flow>`. Skrypt wybiera urządzenie
adaptera i podaje zmienne konta e2e. PASS to status `ok` z przejściem asercji flow.

## Sprawdzenie poprawki wizualnej

Poprawkę sprawdzasz w aplikacji bez zrzutu: `maestro hierarchy --compact` (elementy, teksty, położenie). Kolorów ta komenda nie pokazuje:
przy poprawce koloru dopisujesz `takeScreenshot` we flow i oglądasz plik z pola `zrzuty` wyniku `expo-flow.mjs`.

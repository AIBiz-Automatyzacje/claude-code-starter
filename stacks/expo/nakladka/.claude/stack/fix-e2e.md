# Naprawa E2E — stack Expo (Maestro)

Slot stackowy (rejestr: `stacks/sloty.json`). Rdzeń odsyła tu po narzędzie jazdy w naprawie findingu E2E. Mechanika
wspólna (odznaczanie checkboxów dopiero po PASS, restart serwera `e2e.mjs start`, przeniesienie flow na ręczne
`e2e.mjs manual`, opis ekranu z katalogu makiet) jest w rdzeniu.

## Ponowne odegranie scenariusza

Gdy finding mówi „brak flow”, najpierw piszesz `.maestro/<flow>.yaml` wg pola Pliki i scenariusza IU. Po naprawie przyczyny
uruchamiasz scenariusz na urządzeniu: `maestro test .maestro/<flow>.yaml; echo "kod=$?"`. Przy kilku włączonych urządzeniach wskazujesz
jedno: `maestro --device <id> test …`, a id podają `xcrun simctl list devices booted` i `adb devices`. PASS to kod 0 z przejściem
`assertVisible` z flow.

## Sprawdzenie poprawki wizualnej

Poprawkę sprawdzasz w aplikacji bez zrzutu: `maestro hierarchy --compact` (elementy, teksty, położenie). Kolorów ta komenda nie pokazuje:
przy poprawce koloru dopisujesz `takeScreenshot` we flow i oglądasz zrzut z katalogu `--test-output-dir`.

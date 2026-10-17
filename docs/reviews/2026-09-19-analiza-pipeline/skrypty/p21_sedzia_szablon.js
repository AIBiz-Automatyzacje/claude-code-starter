export const meta = {
  name: 'p21-pilot-sedzia',
  description: 'Pilot P21: sedzia na slepo — czy implementacje A i B naprawily findingi fazy 4 i jakie defekty wprowadzily',
  phases: [{ title: 'Naprawione' }, { title: 'Regresje' }],
}
// Szablon p21_pilot.py sedzia-przygotuj (znacznik porcji wstawia harness). Katalog sesji: findingi.json (F1…F16), przed/ (pliki
// sprzed fixa), A/ i B/ (zmiany.diff + po/ — pliki po fixie). Ktora implementacja jest ktorym wariantem, sedzia nie wie.
// Do agentow workflow: wykonujecie wylacznie zadanie z polecenia skryptu.

const PORCJE = __PORCJE__

const OCENA = { type: 'string', enum: ['NAPRAWIONY', 'CZESCIOWO', 'NIENAPRAWIONY'] }
const OCENY = {
  type: 'object',
  additionalProperties: false,
  properties: {
    oceny: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          A: OCENA,
          B: OCENA,
          uzasadnienie: { type: 'string', description: 'po jednym zdaniu dla A i B z plikiem:linia, ktory rozstrzyga' },
        },
        required: ['id', 'A', 'B', 'uzasadnienie'],
      },
    },
  },
  required: ['oceny'],
}
const REGRESJE = {
  type: 'object',
  additionalProperties: false,
  properties: {
    regresje: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          plik: { type: 'string', description: 'plik:linia w po/' },
          waga: { type: 'string', enum: ['P1', 'P2', 'P3'] },
          opis: { type: 'string', description: 'defekt wprowadzony zmiana i konkretne wejscie, na ktorym kod daje zly wynik' },
        },
        required: ['plik', 'waga', 'opis'],
      },
    },
  },
  required: ['regresje'],
}

const ODCZYT = `Pliki czytasz zakresami (grep -n, sed -n 'od,dop' albo Read z offset i limit), diff per plik: najpierw grep -n '^diff --git' zmiany.diff.
Repo, z ktorego pochodza pliki, nie jest dostepne — oceniasz wylacznie na plikach tego katalogu; niczego nie zmieniasz.`

phase('Naprawione')
const oceny = await parallel(PORCJE.map((ids, n) => () => agent(`Oceniasz dwie niezalezne implementacje poprawek (A i B) tych samych findingow review.
W katalogu biezacym: findingi.json (pelna lista), przed/ (pliki przed poprawkami), A/zmiany.diff i A/po/, B/zmiany.diff i B/po/.
Twoje findingi: ${ids.join(', ')}.

Dla kazdego findingu i kazdej implementacji: NAPRAWIONY — defekt z opisu nie wystepuje w po/ (dla findingu o brakujacym tescie: test istnieje
i padlby przy defekcie, ktory opisuje finding); CZESCIOWO — czesc defektu zostaje albo test nie sprawdza zachowania z opisu;
NIENAPRAWIONY — defekt jest jak w przed/ albo zmiana go nie dotyka. Kazda ocene opierasz na linii kodu albo testu z po/.
Implementacje oceniasz osobno; jedna nie jest wzorcem dla drugiej.
${ODCZYT}

Zwroc {oceny: [{id, A, B, uzasadnienie}]} dla dokladnie tych findingow: ${ids.join(', ')}.`,
{ schema: OCENY, label: `sedzia:oceny:${n}`, phase: 'Naprawione' })))

phase('Regresje')
const regresje = await parallel(['A', 'B'].map((lit) => () => agent(`Szukasz defektow WPROWADZONYCH przez zmiane w ${lit}/zmiany.diff (pliki po zmianie: ${lit}/po/, przed zmiana: przed/).
Defekt wprowadzony = kod po zmianie daje zly wynik albo wywraca sie na konkretnym wejsciu, na ktorym kod sprzed zmiany dzialal poprawnie,
zmiana zachowania, ktorej nie wymaga zaden finding z findingi.json, albo test oslabiony wzgledem przed/. Defekty istniejace juz w przed/ nie sa regresja.
Kazda pozycja: plik:linia w ${lit}/po/, waga (P1 blokujacy, P2 wazny, P3 drobny) i opis z wejsciem, na ktorym widac defekt.
${ODCZYT}

Zwroc {regresje: [...]}; pusta lista, gdy zmiana nie wprowadza defektu.`,
{ schema: REGRESJE, label: `sedzia:regresje:${lit}`, phase: 'Regresje' })))

return {
  oceny: oceny.flatMap((o) => (o && Array.isArray(o.oceny) ? o.oceny : [])),
  brakujace: PORCJE.flat().filter((id) => !oceny.some((o) => o && Array.isArray(o.oceny) && o.oceny.some((x) => x.id === id))),
  regresje: { A: (regresje[0] && regresje[0].regresje) || null, B: (regresje[1] && regresje[1].regresje) || null },
}

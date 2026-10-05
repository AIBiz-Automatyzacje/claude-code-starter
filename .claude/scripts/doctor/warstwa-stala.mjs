// Warstwa stala pliku roli (PLAN-POPRAWY P11): naruszenia zasad pisania i liczba polecen bloku. Uzywaja jej test
// `.claude/workflows/__tests__/warstwa-stala.test.mjs` i doctor (licznik warstwy stalej w instalacji).
//
// Zasady (PROMPT-AUDIT §4, INSPIRACJE A4): polecenia w jednym bloku `## Polecenia` z budzetem pozycji; poza blokiem
// tylko mandat (1–2 zdania) i opis wejscia, bez zdan nakazowych; bez dat, fraz migracyjnych i numerow sekcji.
// Zdanie nakazowe rozpoznaje slownik czasownikow w trybie rozkazujacym (pierwsze slowo zdania, takze po „Nie”)
// i slowa modalne — heurystyka, ktora lapie styl plikow szablonu, nie kazda mozliwa forme.

const NAGLOWEK_BLOKU = '## Polecenia'
export const MAKS_POLECEN = 150
const MAKS_ZDAN_MANDATU = 2

const POZYCJA = /^\s*(?:[-*]|\d+\.)\s+/
const DATA = /\b20\d\d-\d\d-\d\d\b/g
const FRAZA_MIGRACYJNA = /\b(?:jak dot[aą]d|ju[zż] nie)\b/gi
const NUMER_SEKCJI = /§\s*\d+/g
const MODALNE = /\b(?:musisz|nalezy|nie wolno|pamietaj)\b/
const ROZKAZUJACE = new Set([
  'badz', 'cytuj', 'czytaj', 'dodaj', 'dopisz', 'idz', 'klasyfikuj', 'licz', 'miej', 'napisz', 'ocen', 'oceniaj', 'odczytaj',
  'opisz', 'oznacz', 'pisz', 'podaj', 'policz', 'pomijaj', 'pomin', 'popraw', 'porownaj', 'przeczytaj', 'przejdz', 'przejrzyj',
  'rob', 'sklasyfikuj', 'sprawdz', 'sprawdzaj', 'stosuj', 'szukaj', 'traktuj', 'trzymaj', 'unikaj', 'upewnij', 'uruchom', 'ustal',
  'usun', 'uzyj', 'uzywaj', 'wpisz', 'wskaz', 'wybierz', 'wykonaj', 'wypisz', 'wyszukaj', 'zacznij', 'zadbaj', 'zapisz', 'zestaw',
  'zglaszaj', 'zglos', 'zostaw', 'zrob', 'zwracaj', 'zwroc',
])

/**
 * @param {string} tekst
 * @returns {string}  male litery bez polskich znakow (slownik i slowa modalne sa w ASCII)
 */
function ascii(tekst) {
  return tekst.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase()
}

/**
 * @param {string} tekst
 * @returns {string[]}  linie tresci po frontmatterze
 */
function linieCiala(tekst) {
  const czesci = tekst.split(/^---$/m)
  return (czesci.length >= 3 ? czesci.slice(2).join('---') : tekst).split('\n')
}

/**
 * @param {string[]} linie
 * @returns {{ blok: string[], poza: string[], liczbaBlokow: number }}
 */
function podzial(linie) {
  /** @type {string[]} */
  const blok = []
  /** @type {string[]} */
  const poza = []
  let wBloku = false
  let liczbaBlokow = 0
  for (const linia of linie) {
    if (linia.startsWith('## ')) {
      wBloku = linia.trim() === NAGLOWEK_BLOKU
      if (wBloku) liczbaBlokow++
      continue
    }
    if (linia.startsWith('#')) continue
    ;(wBloku ? blok : poza).push(linia)
  }
  return { blok, poza, liczbaBlokow }
}

/**
 * @param {string} tekst
 * @returns {string[]}
 */
function zdania(tekst) {
  return tekst.split(/(?<=[.!?])\s+/).map((z) => z.trim()).filter(Boolean)
}

/**
 * @param {string} zdanie
 * @returns {boolean}
 */
function czyNakazowe(zdanie) {
  const slowa = ascii(zdanie).match(/[a-z]+/g) ?? []
  const pierwsze = slowa[0] === 'nie' ? slowa[1] : slowa[0]
  return ROZKAZUJACE.has(pierwsze ?? '') || MODALNE.test(ascii(zdanie))
}

/**
 * @param {string[]} poza
 * @returns {string[]}  pierwszy akapit tekstu poza blokiem
 */
function mandat(poza) {
  const start = poza.findIndex((l) => l.trim())
  if (start < 0) return []
  const koniec = poza.findIndex((l, i) => i > start && !l.trim())
  return poza.slice(start, koniec < 0 ? undefined : koniec)
}

/**
 * @param {string} tekst  pelny plik roli
 * @returns {number}  pozycje listy w bloku `## Polecenia`
 */
export function liczbaPolecen(tekst) {
  return podzial(linieCiala(tekst)).blok.filter((l) => POZYCJA.test(l)).length
}

/**
 * @param {string} tekst  pelny plik roli
 * @returns {string[]}  opisy naruszen; pusta lista = plik zgodny
 */
export function naruszeniaWarstwy(tekst) {
  const linie = linieCiala(tekst)
  const { poza, liczbaBlokow } = podzial(linie)
  /** @type {string[]} */
  const wynik = []
  if (liczbaBlokow !== 1) wynik.push(`blok "${NAGLOWEK_BLOKU}": ${liczbaBlokow}, oczekiwany 1`)
  const polecen = liczbaPolecen(tekst)
  if (polecen > MAKS_POLECEN) wynik.push(`polecen w bloku: ${polecen}, budzet ${MAKS_POLECEN}`)
  const zdaniaMandatu = zdania(mandat(poza).join(' ')).length
  if (zdaniaMandatu > MAKS_ZDAN_MANDATU) wynik.push(`mandat: ${zdaniaMandatu} zdania, oczekiwane 1–${MAKS_ZDAN_MANDATU}`)
  for (const linia of poza.filter((l) => l.trim())) {
    for (const z of zdania(linia.replace(POZYCJA, '')).filter(czyNakazowe)) wynik.push(`zdanie nakazowe poza blokiem: "${z}"`)
  }
  const cialo = linie.join('\n')
  for (const m of cialo.matchAll(DATA)) wynik.push(`data: "${m[0]}"`)
  for (const m of cialo.matchAll(FRAZA_MIGRACYJNA)) wynik.push(`fraza migracyjna: "${m[0]}"`)
  for (const m of cialo.matchAll(NUMER_SEKCJI)) wynik.push(`numer sekcji zamiast tematu: "${m[0]}"`)
  return wynik
}

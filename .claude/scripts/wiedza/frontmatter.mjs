// Frontmatter plikow docs/solutions/ (PLAN-POPRAWY P10): odczyt i zapis podzbioru YAML, ktorego uzywaja solutions
// (skalary, cudzyslowy, listy blokowe i inline). Bez biblioteki YAML: skrypt dziala w projekcie, ktory jej nie ma.
// Zapis dotyka tylko podanych pol — reszta naglowka i tresc zostaja bajt w bajt.

const ZNACZNIK = '---'
const KLUCZ = /^([A-Za-z_][\w-]*):(?:\s(.*))?$/
const ELEMENT_LISTY = /^\s+-\s?(.*)$/

/** @typedef {Record<string, string | string[]>} Pola */
/** @typedef {{ pola: Pola, linie: string[], zamkniecie: number }} Naglowek */

/** @param {string} surowa @returns {string} */
function skalar(surowa) {
  const v = surowa.trim()
  if (v.startsWith('"') && v.endsWith('"') && v.length > 1) {
    try {
      return JSON.parse(v)
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e
      return v.slice(1, -1)
    }
  }
  if (v.startsWith("'") && v.endsWith("'") && v.length > 1) return v.slice(1, -1).replace(/''/g, "'")
  return v
}

/** @param {string} surowa @returns {string | string[]} */
function wartosc(surowa) {
  const v = surowa.trim()
  if (v.startsWith('[') && v.endsWith(']')) return v.slice(1, -1).split(',').map(skalar).filter((e) => e !== '')
  return skalar(v)
}

/**
 * @param {string} tekst
 * @returns {Naglowek | null} pola naglowka, linie pliku i indeks linii zamykajacej; null gdy pliku nie otwiera `---`
 */
function naglowek(tekst) {
  const linie = tekst.split('\n')
  if (linie[0] !== ZNACZNIK) return null
  const zamkniecie = linie.indexOf(ZNACZNIK, 1)
  if (zamkniecie === -1) return null
  /** @type {Pola} */
  const pola = {}
  /** @type {string | null} */
  let ostatni = null
  for (const linia of linie.slice(1, zamkniecie)) {
    const element = ELEMENT_LISTY.exec(linia)
    const lista = ostatni ? pola[ostatni] : undefined
    if (element && Array.isArray(lista)) {
      lista.push(skalar(element[1]))
      continue
    }
    const klucz = KLUCZ.exec(linia)
    if (!klucz) continue
    ostatni = klucz[1]
    pola[ostatni] = klucz[2]?.trim() ? wartosc(klucz[2]) : []
  }
  return { pola, linie, zamkniecie }
}

/** @param {string} tekst @returns {{ pola: Pola } | null} */
export function czytajFrontmatter(tekst) {
  const n = naglowek(tekst)
  return n && { pola: n.pola }
}

/** @param {string} klucz @param {string | number | string[]} v @returns {string[]} */
function liniePola(klucz, v) {
  if (Array.isArray(v)) return [`${klucz}:`, ...v.map((e) => `  - ${JSON.stringify(e)}`)]
  return [`${klucz}: ${typeof v === 'number' ? v : JSON.stringify(v)}`]
}

/**
 * Ustawia pola w naglowku: istniejace podmienia (razem z elementami listy), nowe dopisuje przed zamknieciem.
 * @param {string} tekst
 * @param {Record<string, string | number | string[]>} pola
 * @returns {string}
 */
export function ustawPola(tekst, pola) {
  const n = naglowek(tekst)
  if (!n) return [ZNACZNIK, ...Object.entries(pola).flatMap(([k, v]) => liniePola(k, v)), ZNACZNIK, tekst].join('\n')
  const wnetrze = []
  /** @type {string | null} */
  let pomijanaLista = null
  for (const linia of n.linie.slice(1, n.zamkniecie)) {
    if (pomijanaLista && ELEMENT_LISTY.test(linia)) continue
    pomijanaLista = null
    const klucz = KLUCZ.exec(linia)?.[1]
    if (klucz && klucz in pola) {
      pomijanaLista = klucz
      continue
    }
    wnetrze.push(linia)
  }
  const nowe = Object.entries(pola).flatMap(([k, v]) => liniePola(k, v))
  return [ZNACZNIK, ...wnetrze, ...nowe, ...n.linie.slice(n.zamkniecie)].join('\n')
}

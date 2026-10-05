// Wpisy wiedzy projektu (PLAN-POPRAWY P10): solution z polami wiedzy we frontmatterze. Odczyt z docs/solutions/
// (bez _archived) z walidacja na plikach repo; wspolny porzadek dla indeksu i wycinka: koszyk „zawsze” najpierw,
// potem waga, ucieczki, klasa i data (nowsze wyzej).

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { czytajFrontmatter } from './frontmatter.mjs'
import { POLA_WIEDZY, POLE_BRAMKI, WAGI, czyZawsze, walidujWpis } from './walidacja.mjs'

export const KATALOG_SOLUTIONS = 'docs/solutions'
const ARCHIWUM = '_archived'
// `date` maja tez solutions sprzed P10 — o tym, ze plik jest wpisem wiedzy, decyduja pozostale pola.
export const POLA_ROZPOZNAJACE = POLA_WIEDZY.filter((p) => p !== 'date')

/** @typedef {import('./frontmatter.mjs').Pola} Pola */
/** @typedef {{ plik: string, pola: Pola }} Wpis */

/** @param {Wpis} w @param {string} pole @returns {string} */
export function pole(w, pole) {
  const v = w.pola[pole]
  return typeof v === 'string' ? v : ''
}

/** @param {Wpis} w @returns {string[]} */
export function sciezkiWpisu(w) {
  const v = w.pola.paths
  return Array.isArray(v) ? v : []
}

/**
 * Wpis obowiazuje agentow (indeks, wycinek): szczebel `regula` albo lekcja `kod`/`lint`, ktorej bramki jeszcze nie wdrozono.
 * @param {Wpis} w
 * @returns {boolean}
 */
export function czyObowiazuje(w) {
  return pole(w, 'szczebel') === 'regula' || !pole(w, POLE_BRAMKI)
}

/** @param {Wpis} a @param {Wpis} b @returns {number} */
export function porownajWpisy(a, b) {
  return Number(czyZawsze(sciezkiWpisu(b))) - Number(czyZawsze(sciezkiWpisu(a)))
    || WAGI.indexOf(pole(a, 'waga')) - WAGI.indexOf(pole(b, 'waga'))
    || Number(pole(b, 'ucieczki')) - Number(pole(a, 'ucieczki'))
    || pole(a, 'klasa').localeCompare(pole(b, 'klasa'))
    || pole(b, 'date').localeCompare(pole(a, 'date'))
}

/** @param {string} projekt @returns {string[]} pliki sledzone i nowe nieignorowane (sciezki wzgledem repo) */
export function plikiRepo(projekt) {
  return execFileSync('git', ['-C', projekt, 'ls-files', '-co', '--exclude-standard'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean)
}

/**
 * @param {string} projekt
 * @param {string[] | null} pliki pliki repo do walidacji globow (null = tylko skladnia)
 * @returns {{ wpisy: Wpis[], bezPol: string[], niepoprawne: { plik: string, bledy: string[] }[] }}
 */
export function wczytajWpisy(projekt, pliki) {
  const katalog = join(projekt, KATALOG_SOLUTIONS)
  /** @type {{ wpisy: Wpis[], bezPol: string[], niepoprawne: { plik: string, bledy: string[] }[] }} */
  const wynik = { wpisy: [], bezPol: [], niepoprawne: [] }
  if (!existsSync(katalog)) return wynik
  const md = readdirSync(katalog, { recursive: true, encoding: 'utf8' })
    .filter((p) => p.endsWith('.md') && !p.split('/').includes(ARCHIWUM)).sort()
  for (const wzgledna of md) {
    const plik = `${KATALOG_SOLUTIONS}/${wzgledna}`
    const pola = czytajFrontmatter(readFileSync(join(katalog, wzgledna), 'utf8'))?.pola
    if (!pola || !POLA_ROZPOZNAJACE.some((p) => p in pola)) {
      wynik.bezPol.push(plik)
      continue
    }
    const { ok, bledy } = walidujWpis(pola, pliki)
    if (ok) wynik.wpisy.push({ plik, pola })
    else wynik.niepoprawne.push({ plik, bledy })
  }
  return wynik
}

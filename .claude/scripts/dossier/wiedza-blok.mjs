// Wiedza projektu w dossier (PLAN-POPRAWY P10): wycinek regul dla plikow fazy zamiast calego learned-patterns
// (reviewer dostaje to samo, co planner wkleja builderom) i rozmiary dla telemetrii faza.wiedza.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PLIK_INDEKSU } from '../wiedza/indeks.mjs'
import { wczytajWpisy } from '../wiedza/wpisy.mjs'
import { wycinek } from '../wiedza/wycinek.mjs'

const CLAUDE_MD = 'CLAUDE.md'

/**
 * @typedef {{ indeksZn: number | null, claudeMdZn: number | null, wycinekZn: number, wycinekWpisy: number,
 *   wycinekPominiete: number }} WiedzaFazy
 */

/** @param {string} projekt @param {string} plik @returns {number | null} znaki pliku; null gdy go nie ma */
function znaki(projekt, plik) {
  const sciezka = join(projekt, plik)
  return existsSync(sciezka) ? readFileSync(sciezka, 'utf8').length : null
}

/**
 * @param {string} projekt
 * @param {string[]} pliki pliki zmienione w fazie
 * @returns {{ blok: string, wiedza: WiedzaFazy }}
 */
export function wiedzaFazy(projekt, pliki) {
  // Globy wpisow sprawdza compound i indeks; tu bez dopasowania do plikow repo, jak w CLI wycinka.
  const w = wycinek(wczytajWpisy(projekt, null).wpisy, pliki)
  return {
    blok: w.tresc || `Brak regul dla plikow fazy (indeks: ${PLIK_INDEKSU}).`,
    wiedza: {
      indeksZn: znaki(projekt, PLIK_INDEKSU), claudeMdZn: znaki(projekt, CLAUDE_MD),
      wycinekZn: w.zn, wycinekWpisy: w.wpisy, wycinekPominiete: w.pominiete,
    },
  }
}

// Wycinek wiedzy (PLAN-POPRAWY P10): reguly projektu dla plikow jednostki (planner → prompt buildera) albo fazy
// (dossier → reviewerzy). Dopasowanie globami `paths` po sciezkach plikow, nie po nazwach w tresci; koszyk „zawsze”
// dochodzi zawsze; lekcje kod/lint bez wdrozonej bramki jak regula. Limit znakow; reszta odeslana do indeksu.

import { posix } from 'node:path'

import { PLIK_INDEKSU, bezDuplikatow } from './indeks.mjs'
import { czyZawsze } from './walidacja.mjs'
import { czyObowiazuje, pole, porownajWpisy, sciezkiWpisu } from './wpisy.mjs'

export const MAKS_WYCINEK_ZN = 2000

/** @typedef {import('./wpisy.mjs').Wpis} Wpis */

/** @param {Wpis} w @param {string[]} pliki @param {boolean} bezZawsze @returns {boolean} */
function pasuje(w, pliki, bezZawsze) {
  const globy = sciezkiWpisu(w)
  if (czyZawsze(globy)) return !bezZawsze
  return pliki.some((p) => globy.some((g) => posix.matchesGlob(p, g)))
}

/** @param {Wpis} w @returns {string} */
function linia(w) {
  return `- [${pole(w, 'waga')}] ${pole(w, 'klasa')}: ${pole(w, 'regula').replace(/\s*\n\s*/g, ' ')} (${w.plik})`
}

/**
 * @param {Wpis[]} wpisy zwalidowane wpisy solutions
 * @param {string[]} pliki sciezki plikow jednostki albo fazy (wzgledem repo)
 * @param {number} [limitZn]
 * @param {{ bezZawsze?: boolean }} [opcje] bezZawsze: bez koszyka „zawsze” — czy obszar plikow ma wlasne wpisy (/dev-plan, research)
 * @returns {{ tresc: string, zn: number, wpisy: number, pominiete: number, pliki: string[] }}
 */
export function wycinek(wpisy, pliki, limitZn = MAKS_WYCINEK_ZN, opcje = {}) {
  const regulyPlikow = wpisy.filter((w) => czyObowiazuje(w) && pasuje(w, pliki, opcje.bezZawsze === true))
  const dopasowane = bezDuplikatow(regulyPlikow).unikalne.sort(porownajWpisy)
  const stopka = (/** @type {number} */ n) => `+${n} regul poza limitem wycinka — pelna lista: ${PLIK_INDEKSU}`
  /** @type {Wpis[]} */
  const wziete = []
  let zn = 0
  for (const w of dopasowane) {
    const dlugosc = linia(w).length + 1
    const rezerwa = wziete.length + 1 < dopasowane.length ? stopka(dopasowane.length).length : 0
    if (zn + dlugosc + rezerwa > limitZn) break
    wziete.push(w)
    zn += dlugosc
  }
  const pominiete = dopasowane.length - wziete.length
  const tresc = [...wziete.map(linia), ...(pominiete ? [stopka(pominiete)] : [])].join('\n')
  return { tresc, zn: tresc.length, wpisy: wziete.length, pominiete, pliki: wziete.map((w) => w.plik) }
}

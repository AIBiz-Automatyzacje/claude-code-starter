// Wycinek wiedzy (PLAN-POPRAWY P10): reguly projektu dla plikow jednostki (planner → prompt buildera) albo fazy
// (dossier → reviewerzy). Dopasowanie globami `paths` po sciezkach plikow, nie po nazwach w tresci; koszyk „zawsze”
// dochodzi zawsze; lekcje kod/lint bez wdrozonej bramki jak regula. Limit znakow; reszta odeslana do indeksu.

import { posix } from 'node:path'

import { PLIK_INDEKSU, bezDuplikatow } from './indeks.mjs'
import { MAKS_KROTKA_ZN, POLE_KROTKIE, czyZawsze, pierwszeZdanie } from './walidacja.mjs'
import { czyObowiazuje, pole, porownajWpisy, sciezkiWpisu } from './wpisy.mjs'

// E5-15(c): 2000 miescilo ~4 pelne reguly (vibersi etap 5: 11 pominietych na IU); z regula skrocona ~5000 zn miesci
// cala baze etapu 5 (15 regul, ~4,1 tys. zn) za ~1 tys. tokenow wiecej na start buildera.
export const MAKS_WYCINEK_ZN = 5000

/** @typedef {import('./wpisy.mjs').Wpis} Wpis */

/** @param {Wpis} w @param {string[]} pliki @param {boolean} bezZawsze @returns {boolean} */
function pasuje(w, pliki, bezZawsze) {
  const globy = sciezkiWpisu(w)
  if (czyZawsze(globy)) return !bezZawsze
  return pliki.some((p) => globy.some((g) => posix.matchesGlob(p, g)))
}

/**
 * E5-15(b): regula skrocona — pole `regula_krotka`, a bez niego pierwsze zdanie reguly, ciete do MAKS_KROTKA_ZN z „…”.
 * Pelna regula zostaje w solution, do ktorego linia linkuje (vibersi etap 5: 4 reguly po 300–465 zn wypelnialy limit).
 * @param {Wpis} w
 * @returns {string}
 */
function regulaKrotka(w) {
  const jednaLinia = (/** @type {string} */ t) => t.replace(/\s*\n\s*/g, ' ').trim()
  const krotka = jednaLinia(pole(w, POLE_KROTKIE)) || pierwszeZdanie(jednaLinia(pole(w, 'regula')))
  return krotka.length > MAKS_KROTKA_ZN ? `${krotka.slice(0, MAKS_KROTKA_ZN - 1).trimEnd()}…` : krotka
}

/** @param {Wpis} w @returns {string} */
function linia(w) {
  return `- [${pole(w, 'waga')}] ${pole(w, 'klasa')}: ${regulaKrotka(w)} (${w.plik})`
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
  const dopasowane = bezDuplikatow(regulyPlikow).unikalne.sort((a, b) => porownajWpisy(a, b, pliki))
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

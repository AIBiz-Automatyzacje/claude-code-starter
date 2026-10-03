// Bramka size-limit: budzet rozmiaru paczki z konfiguracji projektu. Pozycja ponad limit = porazka. Pozycja z rozmiarem 0
// to sciezka, ktora nie wskazuje zadnego pliku (size-limit zwraca wtedy passed: true) — blad, bo budzet nie zostal sprawdzony.

import { bladNarzedzia, uruchom } from './uruchom.mjs'

const SUFIT_SEKUND = 300

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {{ name: string, passed: boolean, size: number, sizeLimit?: number }} PozycjaSizeLimit */

/**
 * @param {string} projekt
 * @param {{ bin: string }} narzedzie
 * @returns {WynikBramki}
 */
export function bramkaSizeLimit(projekt, narzedzie) {
  const p = uruchom(narzedzie.bin, ['--json'], { cwd: projekt, sufitSekund: SUFIT_SEKUND })
  /** @type {PozycjaSizeLimit[] | { error: string }} */
  let raport
  try {
    raport = JSON.parse(p.stdout)
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    return bladNarzedzia(p, 'size-limit')
  }
  if (!Array.isArray(raport)) return { status: 'blad', sekundy: p.sekundy, trafienia: [], powod: `size-limit: ${raport.error}` }
  const pozycje = raport
  const puste = pozycje.filter((r) => r.size === 0)
  if (puste.length) {
    const nazwy = puste.map((r) => `"${r.name}"`).join(', ')
    return { status: 'blad', sekundy: p.sekundy, trafienia: [], powod: `size-limit: ${nazwy} — 0 B, sciezka nie wskazuje plikow (brak builda?)` }
  }
  const trafienia = pozycje
    .filter((r) => !r.passed)
    .map((r) => ({ plik: null, linia: null, regula: 'size-limit', opis: `${r.name}: ${r.size} B > limit ${r.sizeLimit} B` }))
  return { status: trafienia.length ? 'porazka' : 'ok', sekundy: p.sekundy, trafienia }
}

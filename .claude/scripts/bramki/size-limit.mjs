// Bramka size-limit: budzet rozmiaru paczki z konfiguracji projektu. Pozycja ponad limit = porazka. Pozycja z rozmiarem 0
// to sciezka, ktora nie wskazuje zadnego pliku (size-limit zwraca wtedy passed: true) — blad, bo budzet nie zostal sprawdzony.
// Build przed pomiarem (decyzja operatora P6): @size-limit/file mierzy dist, ktory bez builda jest nieaktualny wzgledem fazy.

import { packageJson } from './narzedzia.mjs'
import { bladNarzedzia, uruchom } from './uruchom.mjs'

const SUFIT_SEKUND = 300

/** @param {string} projekt @returns {boolean} */
function maBuild(projekt) {
  const skrypty = packageJson(projekt).scripts
  return typeof skrypty === 'object' && skrypty !== null && 'build' in skrypty
}

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {{ name: string, passed: boolean, size: number, sizeLimit?: number }} PozycjaSizeLimit */

/**
 * @param {string} projekt
 * @param {{ bin: string }} narzedzie
 * @returns {WynikBramki}
 */
export function bramkaSizeLimit(projekt, narzedzie) {
  if (maBuild(projekt)) {
    // npm jest zawsze obok node; `npm run` wola skrypt projektu niezaleznie od menedzera pakietow.
    const build = uruchom('npm', ['run', 'build'], { cwd: projekt, sufitSekund: SUFIT_SEKUND })
    if (build.kod !== 0) return bladNarzedzia(build, 'size-limit (build przed pomiarem)')
  }
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

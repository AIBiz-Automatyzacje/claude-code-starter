// Decyzja publikacji wariantu Expo do workspace-template-mobile (plan szablonu mobile z rdzenia, IU-3.3, D4). Porównuje SHA
// rdzenia do opublikowania z SHA z `.claude/.rdzen-version` repo mobile. Porównanie z ostatnią publikacją, a nie z poprzednim
// pushem, łapie też pushe, po których publikacja nie biegła, a kolejność w historii chroni przed nadpisaniem nowszej publikacji
// starszą, gdy dwa biegi skończą się w odwrotnej kolejności.
//
// Uruchomienie: node stacks/publikuj-mobile.mjs <katalog-startera> <katalog-mobile> <sha>
// Wypisuje `decyzja=<publikuj|bez-zmian|starszy>` na stdout (do $GITHUB_OUTPUT) i powód na stderr.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Ścieżki, od których zależy wynik builda wariantu (rdzeń + nakładka i skrypty budowy w stacks/).
export const SCIEZKI_WARIANTU = ['.claude', 'output-styles', 'stacks']
const PELNY_SHA = /^[0-9a-f]{40}$/

/** @typedef {{ decyzja: 'publikuj' | 'bez-zmian' | 'starszy', powod: string }} Decyzja */

/** @param {string} korzen @param {string[]} argumenty @returns {number} kod wyjścia gita */
const git = (korzen, argumenty) => spawnSync('git', ['-C', korzen, ...argumenty], { stdio: 'ignore' }).status ?? 1

/**
 * SHA ostatniej publikacji z repo mobile; null, gdy repo nie ma pliku albo plik nie niesie pełnego SHA (np. `-dirty` z ręcznej
 * publikacji, stary szablon sprzed builda).
 * @param {string} katalogMobile @returns {string | null}
 */
export function opublikowanySha(katalogMobile) {
  const plik = join(katalogMobile, '.claude', '.rdzen-version')
  if (!existsSync(plik)) return null
  const wersja = readFileSync(plik, 'utf8').trim()
  return PELNY_SHA.test(wersja) ? wersja : null
}

/**
 * @param {{ starter: string, opublikowany: string | null, sha: string }} opcje
 * @returns {Decyzja}
 */
export function decyzja({ starter, opublikowany, sha }) {
  if (!PELNY_SHA.test(sha)) throw new TypeError(`SHA do publikacji nie jest pełnym SHA: ${sha}`)
  if (opublikowany === null) return { decyzja: 'publikuj', powod: 'repo mobile nie ma SHA z publikacji (pierwsza publikacja)' }
  if (opublikowany === sha) return { decyzja: 'bez-zmian', powod: `${sha} już opublikowany` }
  if (git(starter, ['cat-file', '-e', `${opublikowany}^{commit}`]) !== 0) {
    return { decyzja: 'publikuj', powod: `opublikowany ${opublikowany} nie istnieje w historii startera` }
  }
  if (git(starter, ['merge-base', '--is-ancestor', sha, opublikowany]) === 0) {
    return { decyzja: 'starszy', powod: `${sha} jest starszy niż opublikowany ${opublikowany}` }
  }
  if (git(starter, ['merge-base', '--is-ancestor', opublikowany, sha]) !== 0) {
    return { decyzja: 'publikuj', powod: `${sha} nie wywodzi się z opublikowanego ${opublikowany} (przepisana historia)` }
  }
  return git(starter, ['diff', '--quiet', opublikowany, sha, '--', ...SCIEZKI_WARIANTU]) === 0
    ? { decyzja: 'bez-zmian', powod: `od ${opublikowany} brak zmian w ${SCIEZKI_WARIANTU.join(', ')}` }
    : { decyzja: 'publikuj', powod: `zmiany w ${SCIEZKI_WARIANTU.join(', ')} od ${opublikowany}` }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argumenty = process.argv.slice(2)
  if (argumenty.length !== 3) {
    console.error('Użycie: node stacks/publikuj-mobile.mjs <katalog-startera> <katalog-mobile> <sha>')
    process.exit(2)
  }
  const [starter, mobile, sha] = argumenty
  try {
    const wynik = decyzja({ starter, opublikowany: opublikowanySha(mobile), sha })
    console.error(wynik.powod)
    console.log(`decyzja=${wynik.decyzja}`)
  } catch (blad) {
    if (!(blad instanceof TypeError)) throw blad
    console.error(blad.message)
    process.exit(2)
  }
}

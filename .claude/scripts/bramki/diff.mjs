// Zmiany fazy wzgledem bazy: pliki, linie dodane i surowy diff -U0. Baza = commit sprzed fazy; stan = drzewo robocze
// (domkniecie uruchamia bramki PRZED commitem), wiec diff obejmuje commity fazy, zmiany niezacommitowane i pliki nieśledzone.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'

// Duzy diff fazy (lockfile, wygenerowane typy) nie moze wywrocic bramek limitem bufora.
const BUFOR_GITA = 64 * 1024 * 1024

/** @typedef {Record<string, number[]>} LinieDodane plik -> numery linii dodanych lub zmienionych (strona nowa) */
/** @typedef {{ pliki: string[], dodaneLinie: LinieDodane, diffU0: string }} ZmianyFazy */

/** @param {string} repo @param {string[]} argumenty */
export function git(repo, argumenty) {
  return execFileSync('git', ['-C', repo, ...argumenty], { encoding: 'utf8', maxBuffer: BUFOR_GITA, stdio: ['ignore', 'pipe', 'pipe'] })
}

/**
 * Linie dodane z `git diff -U0` (naglowek hunka `@@ -a,b +c,d @@`). Plik usuniety (`+++ /dev/null`) nie ma wpisu.
 * @param {string} diff
 * @returns {LinieDodane}
 */
export function parsujDiffU0(diff) {
  /** @type {LinieDodane} */
  const wynik = {}
  /** @type {string | null} */
  let plik = null
  // Naglowki `---`/`+++` tylko miedzy `diff --git` a pierwszym `@@` — dodana linia "++ b/x" wyglada tak samo.
  let wNaglowku = false
  for (const linia of diff.split('\n')) {
    if (linia.startsWith('diff --git ')) {
      wNaglowku = true
      continue
    }
    if (wNaglowku && linia.startsWith('+++ ')) {
      plik = linia.startsWith('+++ b/') ? linia.slice(6) : null
      if (plik) wynik[plik] = []
      continue
    }
    const hunk = /^@@ -\S+ \+(\d+)(?:,(\d+))? @@/.exec(linia)
    if (hunk) wNaglowku = false
    if (!hunk || !plik) continue
    const start = Number(hunk[1])
    const ile = hunk[2] === undefined ? 1 : Number(hunk[2])
    for (let n = start; n < start + ile; n++) wynik[plik].push(n)
  }
  return Object.fromEntries(Object.entries(wynik).filter(([, linie]) => linie.length))
}

/**
 * Posortowane numery linii -> zakresy [od, do] (kolejne linie scalone).
 * @param {number[]} linie
 * @returns {[number, number][]}
 */
export function zakresy(linie) {
  /** @type {[number, number][]} */
  const wynik = []
  for (const n of linie) {
    const ostatni = wynik[wynik.length - 1]
    if (ostatni && n === ostatni[1] + 1) ostatni[1] = n
    else wynik.push([n, n])
  }
  return wynik
}

/**
 * @param {string} repo katalog projektu (repo git)
 * @param {string} baza commit sprzed fazy
 * @returns {ZmianyFazy}
 */
export function zmianyFazy(repo, baza) {
  try {
    git(repo, ['rev-parse', '--verify', '--quiet', `${baza}^{commit}`])
  } catch (e) {
    throw new Error(`baza fazy "${baza}" nie jest commitem w ${repo}`, { cause: e })
  }
  // --relative: projekt w podkatalogu repo (pakiet monorepo) — sciezki wzgledem projektu, zmiany spoza niego pominiete.
  const diffU0 = git(repo, ['diff', '-U0', '--no-color', '--no-renames', '--no-ext-diff', '--relative', baza, '--'])
  const dodaneLinie = parsujDiffU0(diffU0)
  const zmienione = git(repo, ['diff', '--name-only', '--no-renames', '--relative', '--diff-filter=AM', baza, '--']).split('\n').filter(Boolean)
  const niesledzone = git(repo, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean)
  for (const plik of niesledzone) {
    const ileLinii = readFileSync(join(repo, plik), 'utf8').split('\n').length - 1
    dodaneLinie[plik] = Array.from({ length: Math.max(ileLinii, 1) }, (_, i) => i + 1)
  }
  return { pliki: [...new Set([...zmienione, ...niesledzone])].sort(), dodaneLinie, diffU0 }
}

/**
 * Sciezka z raportu narzedzia (bezwzgledna albo wzgledna) jako sciezka wzgledem projektu. Obie strony po realpath:
 * na macOS katalog tymczasowy /var to dowiazanie do /private/var, a narzedzia raportuja rozne warianty.
 * @param {string} projekt
 * @param {string} sciezka
 * @returns {string}
 */
export function wzgledna(projekt, sciezka) {
  if (!isAbsolute(sciezka)) return sciezka
  const prawdziwa = (/** @type {string} */ s) => (existsSync(s) ? realpathSync(s) : s)
  return relative(prawdziwa(projekt), prawdziwa(sciezka))
}

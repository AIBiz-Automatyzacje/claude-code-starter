// Bramka ESLint: lint plikow kodu zmienionych w fazie konfiguracja projektu. Error w zmienionym pliku = porazka (naprawa
// w domknieciu); warn na linii fazy = ostrzezenie (wejscie dla code-quality); warn na starych liniach pomijany.

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { wzgledna } from './diff.mjs'
import { bladNarzedzia, uruchom } from './uruchom.mjs'

const SUFIT_SEKUND = 600
const PLIK_KODU = /\.(?:[cm]?[jt]s|[jt]sx)$/
const POZIOM_ERROR = 2

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {import('./uruchom.mjs').Trafienie} Trafienie */
/** @typedef {{ filePath: string, messages: { ruleId: string | null, severity: number, line?: number, message: string, fatal?: boolean }[] }} WynikPlikuEslint */

/**
 * @param {string} projekt
 * @param {{ bin: string }} narzedzie
 * @param {import('./diff.mjs').ZmianyFazy} zmiany
 * @returns {WynikBramki}
 */
export function bramkaEslint(projekt, narzedzie, zmiany) {
  const pliki = zmiany.pliki.filter((p) => PLIK_KODU.test(p) && existsSync(join(projekt, p)))
  if (!pliki.length) return { status: 'pominieta', sekundy: null, trafienia: [], powod: 'faza bez zmienionych plikow kodu' }
  const p = uruchom(narzedzie.bin, ['--format', 'json', '--no-warn-ignored', ...pliki], { cwd: projekt, sufitSekund: SUFIT_SEKUND })
  /** @type {WynikPlikuEslint[]} */
  let raport
  try {
    raport = JSON.parse(p.stdout)
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    return bladNarzedzia(p, 'ESLint')
  }
  /** @type {Trafienie[]} */
  const trafienia = []
  /** @type {Trafienie[]} */
  const ostrzezenia = []
  for (const wynikPliku of raport) {
    const plik = wzgledna(projekt, wynikPliku.filePath)
    const linieFazy = new Set(zmiany.dodaneLinie[plik] ?? [])
    for (const m of wynikPliku.messages) {
      const t = { plik, linia: m.line ?? null, regula: m.ruleId ?? (m.fatal ? 'parsowanie' : 'eslint'), opis: m.message }
      if (m.severity === POZIOM_ERROR) trafienia.push(t)
      else if (m.line !== undefined && linieFazy.has(m.line)) ostrzezenia.push(t)
    }
  }
  return { status: trafienia.length ? 'porazka' : 'ok', sekundy: p.sekundy, trafienia, ostrzezenia }
}

#!/usr/bin/env node
// Czesc doctor.sh i bramki gotowosci (P22 A1): runner testow projektu nie moze zbierac testow maszynerii z .claude/**
// (113 plikow node:test). live-10-demo: `vitest run` bez configu zebral je wszystkie („No test suite found”, 113 failed)
// i autopilot stanal na starcie. Odczyt statyczny configu: zbiera = brak configu (domyslny include vitest i testMatch
// jest >= 30 lapia *.test.mjs) albo config bez wykluczenia .claude i z include siegajacym calego repo.
// Wiersz TSV jak advisors.mjs; problem = BRAK, bo run i tak by sie na nim zatrzymal.
//
// Uzycie: node runner-testow.mjs <katalog-projektu>

import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @typedef {{ stan: 'OK' | 'BRAK' | 'nie dotyczy', runner: string | null, szczegol: string, poprawka: string }} WynikRunnera */

const ELEMENT = 'runner testów'
const KATALOG_MASZYNERII = '.claude'
const CONFIG_VITEST = /^vitest\.config\.[cm]?[jt]s$/
const CONFIG_VITE = /^vite\.config\.[cm]?[jt]s$/
const CONFIG_JEST = /^jest\.config\.[cm]?[jt]s$|^jest\.config\.json$/
const POPRAWKA_VITEST_NOWY = "vitest.config.ts: import { configDefaults, defineConfig } from 'vitest/config'; export default defineConfig({ test: { exclude: [...configDefaults.exclude, '.claude/**'] } })"
const POPRAWKA_VITEST = "w bloku test configu: exclude: [...configDefaults.exclude, '.claude/**'] (configDefaults z 'vitest/config')"
const POPRAWKA_JEST = "w konfiguracji jest: testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/']"

/** @param {string} plik @returns {Record<string, unknown>} */
function czytajJson(plik) {
  return existsSync(plik) ? JSON.parse(readFileSync(plik, 'utf8')) : {}
}

/**
 * Wzorce z tablic pod danym kluczem (`include: [...]`, `testMatch: [...]`); blok `coverage: {...}` pominiety — jego
 * include nie zawęża zbierania testow.
 * @param {string} tresc
 * @param {string} klucz
 * @returns {string[] | null} null = klucza nie ma
 */
function wzorce(tresc, klucz) {
  const bezCoverage = tresc.replace(/\bcoverage\s*:\s*\{[^{}]*\}/g, '')
  const tablice = [...bezCoverage.matchAll(new RegExp(`["']?\\b${klucz}["']?\\s*:\\s*\\[([^\\]]*)\\]`, 'g'))]
  if (!tablice.length) return null
  return tablice.flatMap((t) => [...(t[1] ?? '').matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1] ?? ''))
}

/** @param {string} wzorzec @returns {boolean} wzorzec zaczyna sie od katalogu (src/**), nie od dzikiej karty z korzenia */
function zakotwiczony(wzorzec) {
  const bezKorzenia = wzorzec.replace(/^<rootDir>\/?/, '').replace(/^\.(\/|$)/, '')
  return bezKorzenia !== '' && !/^[*?[{(!]/.test(bezKorzenia) && !bezKorzenia.startsWith(KATALOG_MASZYNERII)
}

/**
 * @param {string} tresc tresc configu
 * @param {{ wykluczenia: string, zbieranie: string }} klucze
 * @returns {boolean} config wyklucza .claude albo zbiera tylko z zakotwiczonych katalogow
 */
function configChroni(tresc, klucze) {
  const wyklucza = (wzorce(tresc, klucze.wykluczenia) ?? []).some((w) => w.includes(KATALOG_MASZYNERII))
  const zbierane = wzorce(tresc, klucze.zbieranie)
  return wyklucza || (zbierane !== null && zbierane.length > 0 && zbierane.every(zakotwiczony))
}

/** @param {string} projekt @param {RegExp} wzorzec @returns {string | null} */
function plikConfigu(projekt, wzorzec) {
  return readdirSync(projekt).filter((n) => wzorzec.test(n)).sort()[0] ?? null
}

/** @param {string} projekt @returns {WynikRunnera} */
function sprawdzVitest(projekt) {
  const vitest = plikConfigu(projekt, CONFIG_VITEST)
  const vite = plikConfigu(projekt, CONFIG_VITE)
  const tresc = (/** @type {string} */ n) => readFileSync(join(projekt, n), 'utf8')
  // vitest czyta vite.config.*, gdy nie ma vitest.config.*; vite.config bez bloku `test` = domyslne zbieranie.
  const config = vitest ?? (vite && /\btest\s*:/.test(tresc(vite)) ? vite : null)
  if (!config) {
    return { stan: 'BRAK', runner: 'vitest', szczegol: 'vitest bez configu zbiera testy maszynerii z .claude/** (domyślny include łapie *.test.mjs) — run stanie na starcie', poprawka: POPRAWKA_VITEST_NOWY }
  }
  if (configChroni(tresc(config), { wykluczenia: 'exclude', zbieranie: 'include' })) {
    return { stan: 'OK', runner: 'vitest', szczegol: `${config} nie zbiera .claude/**`, poprawka: '—' }
  }
  return { stan: 'BRAK', runner: 'vitest', szczegol: `${config} bez exclude .claude/** i z include całego repo — vitest zbierze testy maszynerii`, poprawka: POPRAWKA_VITEST }
}

/** @param {string} projekt @param {Record<string, unknown>} pakiet @returns {WynikRunnera} */
function sprawdzJest(projekt, pakiet) {
  const config = plikConfigu(projekt, CONFIG_JEST)
  const tresc = config ? readFileSync(join(projekt, config), 'utf8') : pakiet.jest ? JSON.stringify(pakiet.jest) : null
  if (tresc && configChroni(tresc, { wykluczenia: 'testPathIgnorePatterns', zbieranie: 'roots' })) {
    return { stan: 'OK', runner: 'jest', szczegol: `${config ?? 'package.json#jest'} nie zbiera .claude/**`, poprawka: '—' }
  }
  return { stan: 'BRAK', runner: 'jest', szczegol: `${config ?? (pakiet.jest ? 'package.json#jest' : 'jest bez configu')} — domyślny testMatch (jest >= 30) zbierze testy maszynerii z .claude/**`, poprawka: POPRAWKA_JEST }
}

/**
 * @param {string} projekt katalog projektu
 * @returns {WynikRunnera}
 */
export function sprawdzRunnerTestow(projekt) {
  const pakiet = czytajJson(join(projekt, 'package.json'))
  const skrypty = /** @type {Record<string, unknown>} */ (pakiet.scripts ?? {})
  const zaleznosci = { .../** @type {object} */ (pakiet.dependencies ?? {}), .../** @type {object} */ (pakiet.devDependencies ?? {}) }
  const test = typeof skrypty.test === 'string' ? skrypty.test : ''
  if (/\bvitest\b/.test(test) || ('vitest' in zaleznosci && !/\bjest\b/.test(test))) return sprawdzVitest(projekt)
  if (/\bjest\b/.test(test) || 'jest' in zaleznosci) return sprawdzJest(projekt, pakiet)
  return { stan: 'nie dotyczy', runner: null, szczegol: 'projekt nie używa vitest ani jest', poprawka: '—' }
}

// realpath: katalog tymczasowy macOS (/var → /private/var) daje rozne zapisy tej samej sciezki.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projekt = process.argv[2]
  if (!projekt) {
    process.stderr.write('Użycie: node runner-testow.mjs <katalog-projektu>\n')
    process.exit(2)
  }
  const { stan, szczegol, poprawka } = sprawdzRunnerTestow(projekt)
  process.stdout.write(`${[ELEMENT, stan, szczegol, poprawka].join('\t')}\n`)
}

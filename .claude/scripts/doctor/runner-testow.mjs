#!/usr/bin/env node
// Czesc doctor.sh i bramki gotowosci (P22 A1): runner testow projektu nie moze zbierac testow maszynerii z .claude/**
// (113 plikow node:test). live-10-demo: `vitest run` bez configu zebral je wszystkie („No test suite found”, 113 failed)
// i autopilot stanal na starcie.
// Zrodlo prawdy: lista plikow od samego runnera (`vitest list --filesOnly --json`, `jest --listTests --json`) z argumentami
// skryptu `test` — config z mergeConfig, projects, dir i -c liczy runner, nie regex. Bez zainstalowanego runnera zostaje
// odczyt statyczny: brak configu = BRAK (domyslny include vitest i testMatch jest >= 30 lapia *.test.mjs), reszta = UWAGA.
// Wiersz TSV jak advisors.mjs; problem = BRAK, bo run i tak by sie na nim zatrzymal.
//
// Uzycie: node runner-testow.mjs <katalog-projektu>

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @typedef {'vitest' | 'jest'} Runner */
/** @typedef {{ stan: 'OK' | 'BRAK' | 'UWAGA' | 'nie dotyczy', runner: Runner | null, szczegol: string, poprawka: string }} WynikRunnera */

const ELEMENT = 'runner testów'
const KATALOG_MASZYNERII = '.claude'
const LIMIT_LISTY_MS = 120_000
// Kolejnosc szukania configu jak w vitest (ts, mts, cts, js, mjs, cjs).
const ROZSZERZENIA = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs']
const WYKLUCZENIE_VITEST = "exclude: [...configDefaults.exclude, '.claude/**'] (configDefaults z 'vitest/config')"
const POPRAWKA_JEST = "w konfiguracji jest: testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/']"
const TRYBY = ['run', 'watch', 'dev', '--run', '--watch', '--watchAll']

/** @param {string} projekt @param {string} baza @returns {string | null} pierwszy istniejacy plik configu w kolejnosci vitest */
function plikConfigu(projekt, baza) {
  return ROZSZERZENIA.map((r) => `${baza}.${r}`).find((n) => existsSync(join(projekt, n))) ?? null
}

/** @param {string} projekt @returns {string | null} vitest.config.* albo vite.config.* (vitest czyta go, gdy nie ma vitest.config) */
function configVitest(projekt) {
  return plikConfigu(projekt, 'vitest.config') ?? plikConfigu(projekt, 'vite.config')
}

/** @param {string} projekt @returns {WynikRunnera['poprawka']} */
function poprawkaVitest(projekt) {
  const config = configVitest(projekt)
  if (config) return `w ${config}, w bloku test (dopisz blok, gdy go nie ma): ${WYKLUCZENIE_VITEST}`
  return "vitest.config.ts: import { configDefaults, defineConfig } from 'vitest/config'; export default defineConfig({ test: { exclude: [...configDefaults.exclude, '.claude/**'] } })"
}

/**
 * Argumenty runnera ze skryptu `test` (`vitest run -c vitest.ci.ts src` → `-c vitest.ci.ts src`): do pierwszego
 * separatora powloki, bez podpolecenia trybu (run, watch, --run, --watch).
 * @param {string} skrypt
 * @param {Runner} runner
 * @returns {string[]}
 */
export function argumentySkryptu(skrypt, runner) {
  for (const segment of skrypt.split(/&&|\|\||[;|]/)) {
    const slowa = segment.split(/\s+/).filter(Boolean)
    const start = slowa.findIndex((s) => s === runner || s.endsWith(`/${runner}`))
    if (start === -1) continue
    return slowa.slice(start + 1)
      .filter((s) => !TRYBY.includes(s))
      .map((s) => s.replace(/^(["'])(.*)\1$/, '$2'))
  }
  return []
}

/**
 * Pliki testow wg samego runnera.
 * @param {string} projekt
 * @param {Runner} runner
 * @param {string[]} argumenty argumenty ze skryptu test
 * @returns {{ pliki: string[] } | { blad: string }}
 */
function listaRunnera(projekt, runner, argumenty) {
  const bin = join(projekt, 'node_modules', '.bin', runner)
  if (!existsSync(bin)) return { blad: `brak node_modules/.bin/${runner}` }
  const polecenie = runner === 'vitest' ? ['list', '--filesOnly', '--json', ...argumenty] : ['--listTests', '--json', ...argumenty]
  try {
    const wyjscie = execFileSync(bin, polecenie, { cwd: projekt, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: LIMIT_LISTY_MS, maxBuffer: 64 * 1024 * 1024 })
    const json = JSON.parse(wyjscie.slice(wyjscie.indexOf('[')))
    if (!Array.isArray(json)) return { blad: `${runner}: wynik listy nie jest tablicą` }
    return { pliki: json.map((p) => (typeof p === 'string' ? p : String(p?.file ?? ''))) }
  } catch (e) {
    const tresc = e instanceof Error ? ('stderr' in e && String(e.stderr).trim()) || e.message : String(e)
    return { blad: `${runner} ${polecenie[0]}: ${tresc.split('\n')[0]}` }
  }
}

/** @param {string} projekt @param {string} plik @returns {string[]} segmenty sciezki pliku wzgledem projektu */
function segmenty(projekt, plik) {
  return relative(resolve(projekt), resolve(projekt, plik)).split(sep)
}

/**
 * Werdykt z listy runnera: pliki z .claude/** albo z node_modules (exclude bez configDefaults) = BRAK.
 * @param {string} projekt @param {Runner} runner @param {string[]} pliki @returns {WynikRunnera}
 */
function werdyktListy(projekt, runner, pliki) {
  const maszyneria = pliki.filter((p) => segmenty(projekt, p)[0] === KATALOG_MASZYNERII)
  const zaleznosci = pliki.filter((p) => segmenty(projekt, p).includes('node_modules'))
  const poprawka = runner === 'vitest' ? poprawkaVitest(projekt) : POPRAWKA_JEST
  if (maszyneria.length) {
    return { stan: 'BRAK', runner, szczegol: `${runner} zbiera ${maszyneria.length} plików testów maszynerii z .claude/** (z ${pliki.length}) — run stanie na starcie`, poprawka }
  }
  if (zaleznosci.length) {
    return { stan: 'BRAK', runner, szczegol: `${runner} zbiera ${zaleznosci.length} plików testów z node_modules (exclude bez wartości domyślnych) — run stanie na starcie`, poprawka }
  }
  return { stan: 'OK', runner, szczegol: `${runner}: ${pliki.length} plików testów, 0 z .claude/**`, poprawka: '—' }
}

/**
 * Odczyt statyczny, gdy runnera nie da sie uruchomic (brak node_modules, stara wersja bez listy): pewny jest tylko brak configu.
 * @param {string} projekt @param {Runner} runner @param {Record<string, unknown>} pakiet @param {string} powod
 * @returns {WynikRunnera}
 */
function odczytStatyczny(projekt, runner, pakiet, powod) {
  if (runner === 'vitest') {
    const config = configVitest(projekt)
    const maTest = config !== null && (config.startsWith('vitest.') || /\btest\s*:/.test(readFileSync(join(projekt, config), 'utf8')))
    if (!maTest) return { stan: 'BRAK', runner, szczegol: `vitest bez configu testów zbiera testy maszynerii z .claude/** (domyślny include łapie *.test.mjs); ${powod}`, poprawka: poprawkaVitest(projekt) }
    return { stan: 'UWAGA', runner, szczegol: `nie sprawdzono listy testów (${powod}); ${config} — sprawdź, czy ma exclude .claude/**`, poprawka: poprawkaVitest(projekt) }
  }
  const config = readdirSync(projekt).find((n) => /^jest\.config\./.test(n)) ?? (pakiet.jest ? 'package.json#jest' : null)
  if (!config) return { stan: 'BRAK', runner, szczegol: `jest bez configu — domyślny testMatch (jest >= 30) zbiera testy maszynerii z .claude/**; ${powod}`, poprawka: POPRAWKA_JEST }
  return { stan: 'UWAGA', runner, szczegol: `nie sprawdzono listy testów (${powod}); ${config} — sprawdź, czy ma testPathIgnorePatterns z .claude/`, poprawka: POPRAWKA_JEST }
}

/** @param {Record<string, unknown>} pakiet @returns {Runner | null} */
function wykryjRunner(pakiet) {
  const skrypty = /** @type {Record<string, unknown>} */ (pakiet.scripts ?? {})
  const test = typeof skrypty.test === 'string' ? skrypty.test : ''
  const zaleznosci = { .../** @type {object} */ (pakiet.dependencies ?? {}), .../** @type {object} */ (pakiet.devDependencies ?? {}) }
  if (/\bvitest\b/.test(test)) return 'vitest'
  if (/\bjest\b/.test(test)) return 'jest'
  if ('vitest' in zaleznosci) return 'vitest'
  if ('jest' in zaleznosci) return 'jest'
  return null
}

/**
 * @param {string} projekt katalog projektu
 * @returns {WynikRunnera}
 */
export function sprawdzRunnerTestow(projekt) {
  const plikPakietu = join(projekt, 'package.json')
  /** @type {Record<string, unknown>} */
  let pakiet
  try {
    pakiet = existsSync(plikPakietu) ? JSON.parse(readFileSync(plikPakietu, 'utf8')) : {}
  } catch (e) {
    return { stan: 'UWAGA', runner: null, szczegol: `package.json nie parsuje się: ${e instanceof Error ? e.message : String(e)}`, poprawka: 'popraw JSON w package.json' }
  }
  const runner = wykryjRunner(pakiet)
  if (!runner) return { stan: 'nie dotyczy', runner: null, szczegol: 'projekt nie używa vitest ani jest', poprawka: '—' }
  const skrypty = /** @type {Record<string, unknown>} */ (pakiet.scripts ?? {})
  const lista = listaRunnera(projekt, runner, argumentySkryptu(typeof skrypty.test === 'string' ? skrypty.test : '', runner))
  return 'pliki' in lista ? werdyktListy(projekt, runner, lista.pliki) : odczytStatyczny(projekt, runner, pakiet, lista.blad)
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

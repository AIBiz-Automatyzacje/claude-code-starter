// Wykrycie narzedzi bramek w projekcie. Narzedzie jest, gdy projekt ma binarke w node_modules/.bin (zaleznosc projektu,
// nie globalna instalacja) i plik konfiguracji; inaczej bramka dostaje status `brak` z powodem.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** @typedef {{ jest: true, bin: string, konfiguracja: string | null } | { jest: false, powod: string }} Narzedzie */
/** @typedef {{ eslint: Narzedzie, tsc: Narzedzie, vitest: Narzedzie, knip: Narzedzie, sizeLimit: Narzedzie, stryker: Narzedzie }} Narzedzia */

const KONFIGURACJE = {
  eslint: ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts', 'eslint.config.cts'],
  tsc: ['tsconfig.json'],
  knip: ['knip.json', 'knip.jsonc', '.knip.json', '.knip.jsonc', 'knip.ts', 'knip.config.ts', 'knip.js', 'knip.config.js'],
  sizeLimit: ['.size-limit.json', '.size-limit.js', '.size-limit.mjs', '.size-limit.cjs', '.size-limit.ts'],
  stryker: ['stryker.config.json', 'stryker.config.mjs', 'stryker.config.js', 'stryker.config.cjs', 'stryker.conf.json', 'stryker.conf.mjs', 'stryker.conf.js', 'stryker.conf.cjs'],
}

/** @param {string} projekt @returns {Record<string, unknown>} */
export function packageJson(projekt) {
  const sciezka = join(projekt, 'package.json')
  if (!existsSync(sciezka)) return {}
  const dane = JSON.parse(readFileSync(sciezka, 'utf8'))
  return dane && typeof dane === 'object' ? dane : {}
}

/**
 * @param {string} projekt
 * @param {string} binarka nazwa w node_modules/.bin
 * @param {string[] | null} pliki pliki konfiguracji (null = narzedzie nie wymaga konfiguracji)
 * @param {string | null} kluczPackageJson klucz konfiguracji w package.json
 * @returns {Narzedzie}
 */
function narzedzie(projekt, binarka, pliki, kluczPackageJson = null) {
  const bin = join(projekt, 'node_modules', '.bin', binarka)
  if (!existsSync(bin)) return { jest: false, powod: `brak node_modules/.bin/${binarka} (zaleznosc projektu)` }
  if (!pliki) return { jest: true, bin, konfiguracja: null }
  const plik = pliki.find((p) => existsSync(join(projekt, p)))
  if (plik) return { jest: true, bin, konfiguracja: plik }
  if (kluczPackageJson && kluczPackageJson in packageJson(projekt)) return { jest: true, bin, konfiguracja: `package.json#${kluczPackageJson}` }
  return { jest: false, powod: `brak konfiguracji (${pliki[0]}${pliki.length > 1 ? ` i ${pliki.length - 1} wariantow nazwy` : ''})` }
}

/**
 * @param {string} projekt katalog glowny projektu
 * @returns {Narzedzia}
 */
export function wykryjNarzedzia(projekt) {
  return {
    eslint: narzedzie(projekt, 'eslint', KONFIGURACJE.eslint),
    tsc: narzedzie(projekt, 'tsc', KONFIGURACJE.tsc),
    vitest: narzedzie(projekt, 'vitest', null),
    knip: narzedzie(projekt, 'knip', KONFIGURACJE.knip, 'knip'),
    sizeLimit: narzedzie(projekt, 'size-limit', KONFIGURACJE.sizeLimit, 'size-limit'),
    stryker: narzedzie(projekt, 'stryker', KONFIGURACJE.stryker),
  }
}

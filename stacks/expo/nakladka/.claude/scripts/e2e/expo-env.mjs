// Zmienne klienta dla E2E na Expo (D13): adapter zapisuje EXPO_PUBLIC_* z .env.e2e do .env.development.local i usuwa ten plik po
// przebiegu. Plik ma w trybie dev najwyzszy priorytet, a .env.local operatora zostaje nietkniety (spike SDK 58, pkt 5). Env procesu
// Metro przegrywa w dev z plikami, a .env.e2e Expo nie laduje, wiec innej drogi nie ma.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const PLIK_DEV = '.env.development.local'
// Kopia pliku operatora: pasuje do `.env*.local` z .gitignore szablonu Expo, a Expo jej nie laduje.
export const PLIK_KOPII = '.env.kopia-e2e.local'
export const ZNACZNIK = '# Zapisane przez adapter E2E (e2e.mjs start). Usuwa je e2e.mjs stop; przykrywa .env.local w trybie dev.'
const KLIENT = /^\s*(?:export\s+)?EXPO_PUBLIC_[A-Za-z0-9_]*\s*=/

/** @typedef {{ ok: boolean, detal: string, naprawa: string }} WynikEnv */

/** @param {string} projekt @param {string} plik @returns {boolean} */
const ignorowany = (projekt, plik) => spawnSync('git', ['check-ignore', '-q', plik], { cwd: projekt }).status === 0

/** @param {string} projekt @returns {boolean} plik istnieje i niesie znacznik adaptera */
export function plikAdaptera(projekt) {
  const sciezka = join(projekt, PLIK_DEV)
  return existsSync(sciezka) && readFileSync(sciezka, 'utf8').startsWith(ZNACZNIK)
}

/**
 * Linie EXPO_PUBLIC_* przepisane dosłownie, żeby cudzysłowy i rozwijanie zmiennych działały tak samo jak w .env.e2e.
 * @param {string} tresc zawartość .env.e2e @returns {string}
 */
export function linieKlienta(tresc) {
  return tresc.split('\n').filter((l) => KLIENT.test(l)).join('\n')
}

/**
 * Zapis pliku env e2e. Plik operatora dostaje kopię; pozostałość po poprzednim przebiegu (znacznik) jest nadpisywana i nazwana w detalu.
 * Zapisuje dopiero po sprawdzeniu .gitignore, bo plik niesie dane konta testowego.
 * @param {string} projekt @param {{ czyIgnorowany?: (projekt: string, plik: string) => boolean }} [opcje] @returns {WynikEnv}
 */
export function zapiszEnvE2e(projekt, { czyIgnorowany = ignorowany } = {}) {
  const niezignorowane = [PLIK_DEV, PLIK_KOPII].filter((p) => !czyIgnorowany(projekt, p))
  if (niezignorowane.length) {
    return { ok: false, detal: `${niezignorowane.join(', ')} poza .gitignore`, naprawa: 'Dopisz `.env*.local` do .gitignore: pliki niosą dane konta testowego.' }
  }
  const sciezka = join(projekt, PLIK_DEV)
  const kopia = join(projekt, PLIK_KOPII)
  const pozostalosc = plikAdaptera(projekt)
  const operatora = existsSync(sciezka) && !pozostalosc
  if (operatora && existsSync(kopia)) {
    return { ok: false, detal: `${PLIK_DEV} bez znacznika adaptera, a ${PLIK_KOPII} już istnieje`, naprawa: `Zdecyduj, który plik zostaje: usuń albo przenieś jeden z nich, adapter nie nadpisze żadnego.` }
  }
  if (operatora) renameSync(sciezka, kopia)
  writeFileSync(sciezka, `${ZNACZNIK}\n${linieKlienta(readFileSync(join(projekt, '.env.e2e'), 'utf8'))}\n`)
  const zrodlo = operatora ? `plik operatora w ${PLIK_KOPII}` : pozostalosc ? 'nadpisana pozostałość po poprzednim przebiegu' : 'nowy'
  return { ok: true, detal: `${PLIK_DEV}: ${zrodlo}`, naprawa: '' }
}

/**
 * Sprzątanie po przebiegu: plik z naszym znacznikiem znika, kopia pliku operatora wraca. Plik bez znacznika należy do operatora.
 * @param {string} projekt @returns {{ detal: string }}
 */
export function cofnijEnvE2e(projekt) {
  const kopia = join(projekt, PLIK_KOPII)
  const nasz = plikAdaptera(projekt)
  if (nasz) rmSync(join(projekt, PLIK_DEV))
  if (!existsSync(kopia)) return { detal: nasz ? `${PLIK_DEV} usunięty` : '' }
  if (existsSync(join(projekt, PLIK_DEV))) return { detal: `${PLIK_KOPII} zostaje: ${PLIK_DEV} bez znacznika adaptera należy do operatora` }
  renameSync(kopia, join(projekt, PLIK_DEV))
  return { detal: `${PLIK_DEV} operatora przywrócony` }
}

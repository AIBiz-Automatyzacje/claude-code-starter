#!/usr/bin/env node
// Czesc doctor.sh: narzedzie jazdy testera E2E z adaptera stacku (`NARZEDZIE_JAZDY` w e2e/adapter.mjs). Musi byc w PATH:
// skill narzedzia i feature-tester-e2e wolaja gola komende, wiec sama devDependency projektu (node_modules/.bin) w runie
// jej nie znajdzie. Wiersz TSV jak port-e2e.mjs.
//
// Uzycie: node narzedzie-jazdy.mjs <katalog-projektu>
//         node narzedzie-jazdy.mjs --nie-dotyczy <powod>

import { spawnSync } from 'node:child_process'
import { accessSync, constants } from 'node:fs'
import { join } from 'node:path'

import { NARZEDZIE_JAZDY } from '../e2e/adapter.mjs'

const { nazwa, instalacja } = NARZEDZIE_JAZDY

/** @param {string} komenda @returns {string} pierwsza niepusta linia `--version` albo „?” (jak `wersja` w doctor.sh) */
function wersja(komenda) {
  const w = spawnSync(komenda, ['--version'], { encoding: 'utf8' })
  return (w.stdout || '').split('\n').find((l) => l.length > 0) ?? '?'
}

/** @param {string} sciezka @returns {boolean} */
function wykonywalny(sciezka) {
  try {
    accessSync(sciezka, constants.X_OK)
    return true
  } catch (e) {
    // Brak pliku albo prawa wykonania to odpowiedz „nie ma”, nie awaria doctora.
    if (e instanceof Error && 'code' in e && (e.code === 'ENOENT' || e.code === 'EACCES')) return false
    throw e
  }
}

/** @param {string} projekt @returns {[string, string, string, string]} */
function wierszNarzedzia(projekt) {
  if (spawnSync('/bin/sh', ['-c', 'command -v "$1"', 'sh', nazwa]).status === 0) return [nazwa, 'OK', wersja(nazwa), '—']
  const lokalny = join(projekt, 'node_modules', '.bin', nazwa)
  if (wykonywalny(lokalny)) return [nazwa, 'BRAK', `${wersja(lokalny)} tylko w node_modules/.bin — pipeline woła ${nazwa} z PATH`, instalacja]
  return [nazwa, 'BRAK', 'brak w PATH', instalacja]
}

const [pierwszy, powod] = process.argv.slice(2)
if (!pierwszy || (pierwszy === '--nie-dotyczy' && !powod)) {
  process.stderr.write('Użycie: node narzedzie-jazdy.mjs <katalog-projektu> | --nie-dotyczy <powód>\n')
  process.exit(2)
}
const wiersz = pierwszy === '--nie-dotyczy' ? [nazwa, 'nie dotyczy', powod, '—'] : wierszNarzedzia(pierwszy)
process.stdout.write(`${wiersz.join('\t')}\n`)

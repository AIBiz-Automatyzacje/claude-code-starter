#!/usr/bin/env node
// Czesc doctor.sh: devDependencies bramek domkniecia (.claude/templates/bramki/package.json) w projekcie, ktory uzywa
// konfiguracji ESLint z szablonu (komentarz ze sciezka .claude/templates/bramki w eslint.config.*). Wiersz TSV jak
// ustawienia.mjs. Brak zaleznosci = UWAGA, nie BRAK: bramka bez narzedzia daje status `brak`, run idzie dalej.
//
// Uzycie: node zaleznosci-bramek.mjs <katalog-projektu>

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @typedef {[string, string, string, string]} Wiersz */

const ELEMENT = 'bramki domknięcia'
const LISTA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'templates', 'bramki', 'package.json')
const ZNACZNIK = '.claude/templates/bramki'
// typescript-eslint (reguly typowane) i Stryker uzywaja API JS TypeScriptu, ktorego TS >= 6.1 (natywny) nie ma.
const TS_MAKS = [6, 1]

/** @param {string} plik @returns {Record<string, unknown>} */
function czytajJson(plik) {
  return existsSync(plik) ? JSON.parse(readFileSync(plik, 'utf8')) : {}
}

/** @param {string} projekt @returns {{ zSzablonu: boolean, wlasna: string | null }} */
function konfiguracjaEslint(projekt) {
  const pliki = readdirSync(projekt).filter((n) => /^eslint\.config\.[cm]?[jt]s$/.test(n))
  const zSzablonu = pliki.some((n) => readFileSync(join(projekt, n), 'utf8').includes(ZNACZNIK))
  return { zSzablonu, wlasna: zSzablonu ? null : pliki[0] ?? null }
}

/** @param {string} projekt @param {string} nazwa @returns {string | null} wersja zainstalowanej paczki */
function zainstalowana(projekt, nazwa) {
  const wersja = czytajJson(join(projekt, 'node_modules', nazwa, 'package.json')).version
  return typeof wersja === 'string' ? wersja : null
}

/**
 * @param {string} projekt
 * @param {Record<string, string>} wymagane nazwa -> dokladna wersja
 * @returns {Wiersz}
 */
export function wierszBramek(projekt, wymagane) {
  const { zSzablonu, wlasna } = konfiguracjaEslint(projekt)
  // Pilot mobile W6: Nawykometr ma wlasny eslint.config.js (eslint 9, eslint-config-expo) — wiersz „nie dotyczy” ukrywal, ze bramka
  // ESLint biegnie na regulach projektu, bez regul szablonu (rozmiar pliku, zlozonosc), a reszta bramek bez swoich konfiguracji.
  if (wlasna) {
    return [ELEMENT, 'UWAGA', `własny ${wlasna} bez konfiguracji szablonu — bramka ESLint biegnie na regułach projektu, bez reguł szablonu`,
      'osobne zadanie sprzątające: konfiguracja z .claude/templates/bramki/eslint.config.szablon.ts (README szablonu: „Bramki domknięcia”)']
  }
  if (!zSzablonu) {
    return [ELEMENT, 'nie dotyczy', 'brak eslint.config.* (README: „Bramki domknięcia”)', '—']
  }
  const brakujace = Object.keys(wymagane).filter((n) => !zainstalowana(projekt, n))
  const problemy = brakujace.length ? [`brak: ${brakujace.join(', ')}`] : []
  const ts = zainstalowana(projekt, 'typescript')
  const [major = 0, minor = 0] = (ts ?? '').split('.').map(Number)
  if (ts && (major > TS_MAKS[0] || (major === TS_MAKS[0] && minor >= TS_MAKS[1]))) {
    problemy.push(`typescript ${ts} — reguły typowane ESLint i Stryker wymagają < ${TS_MAKS.join('.')}`)
  }
  if (!problemy.length) return [ELEMENT, 'OK', `${Object.keys(wymagane).length} paczek z .claude/templates/bramki/package.json`, '—']
  const doInstalacji = (brakujace.length ? brakujace : ['typescript']).map((n) => `${n}@${wymagane[n]}`).join(' ')
  const menedzer = existsSync(join(projekt, 'pnpm-lock.yaml')) ? 'pnpm add -D -E' : 'npm install -D -E'
  return [ELEMENT, 'UWAGA', problemy.join('; '), `${menedzer} ${doInstalacji}`]
}

const projekt = process.argv[2]
if (!projekt) {
  process.stderr.write('Użycie: node zaleznosci-bramek.mjs <katalog-projektu>\n')
  process.exit(2)
}
const { devDependencies } = czytajJson(LISTA)
process.stdout.write(`${wierszBramek(projekt, devDependencies && typeof devDependencies === 'object' ? Object.fromEntries(Object.entries(devDependencies)) : {}).join('\t')}\n`)

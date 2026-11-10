#!/usr/bin/env node
// Tryb recenzji PR projektu (znaleziska szablonu, punkt 39): z botem (CodeRabbit) albo bez bota.
//
// CodeRabbit jest opcjonalny (decyzja operatora 2026-11-08), ale braku bota nie da sie wykryc: brak `.coderabbit.yaml` ani brak
// check-runu po pushu nie dowodza, ze aplikacji nie ma (bot bywa wstrzymany, pomija PR, wyczerpal limit). Wybor zapisuje
// operator raz, w pliku projektu `.claude/projekt.json`. Szablon tego pliku nie dostarcza, wiec /sync-template go nie nadpisuje.
// Czytaja go: /dev-pr (tryb bez bota), /dev-plan i archiwizacja (prog 150 plikow to limit recenzji bota), doctor.
//
// Uzycie (z katalogu projektu albo z --projekt <katalog>):
//   tryb-recenzji.mjs                     odczyt: { recenzjaPr: "bot" | "bez-bota", plik, konfigBota, blad }
//   tryb-recenzji.mjs --ustaw bez-bota    zapis pola recenzjaPr w .claude/projekt.json (inne pola pliku zostaja); commit robi wolajacy
//   tryb-recenzji.mjs --ustaw bot
// Wynik: JSON w jednej linii. Kod wyjscia: 0 = ok, 1 = plik ustawien nieczytelny, 2 = zle argumenty.

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

export const PLIK_USTAWIEN = '.claude/projekt.json'
export const TRYBY_RECENZJI = /** @type {const} */ (['bot', 'bez-bota'])
const PLIK_KONFIGU_BOTA = '.coderabbit.yaml'

/** @typedef {{ recenzjaPr: 'bot' | 'bez-bota', plik: boolean, konfigBota: boolean, blad: string | null }} TrybRecenzji */

/**
 * @param {string} projekt
 * @returns {{ dane: Record<string, unknown>, plik: boolean, blad: string | null }} zawartosc pliku ustawien projektu
 */
function odczyt(projekt) {
  const sciezka = join(projekt, PLIK_USTAWIEN)
  if (!existsSync(sciezka)) return { dane: {}, plik: false, blad: null }
  try {
    const dane = JSON.parse(readFileSync(sciezka, 'utf8'))
    if (!dane || typeof dane !== 'object' || Array.isArray(dane)) return { dane: {}, plik: true, blad: `${PLIK_USTAWIEN}: oczekiwany obiekt JSON` }
    return { dane, plik: true, blad: null }
  } catch (e) {
    return { dane: {}, plik: true, blad: `${PLIK_USTAWIEN}: ${e instanceof Error ? e.message : String(e)}` }
  }
}

/**
 * Brak pliku, brak pola i plik nieczytelny daja „bot”: bramki recenzji bota zostaja, dopoki operator jawnie ich nie zdejmie.
 * @param {string} projekt
 * @returns {TrybRecenzji}
 */
export function trybRecenzji(projekt) {
  const { dane, plik, blad } = odczyt(projekt)
  const konfigBota = existsSync(join(projekt, PLIK_KONFIGU_BOTA))
  const wartosc = dane.recenzjaPr
  if (blad) return { recenzjaPr: 'bot', plik, konfigBota, blad }
  if (wartosc === undefined) return { recenzjaPr: 'bot', plik, konfigBota, blad: null }
  if (wartosc !== 'bot' && wartosc !== 'bez-bota') {
    return { recenzjaPr: 'bot', plik, konfigBota, blad: `${PLIK_USTAWIEN}: recenzjaPr = ${JSON.stringify(wartosc)} — dozwolone: ${TRYBY_RECENZJI.join(', ')}` }
  }
  return { recenzjaPr: wartosc, plik, konfigBota, blad: null }
}

/** @param {string} projekt @returns {boolean} projekt z jawnym wyborem „bez bota recenzji” */
export function projektBezBota(projekt) {
  return trybRecenzji(projekt).recenzjaPr === 'bez-bota'
}

/**
 * @param {string} projekt
 * @param {'bot' | 'bez-bota'} tryb
 * @returns {TrybRecenzji} stan po zapisie; plik nieczytelny nie jest nadpisywany (blad)
 */
export function ustawTrybRecenzji(projekt, tryb) {
  const { dane, blad } = odczyt(projekt)
  if (blad) return { ...trybRecenzji(projekt), blad: `${blad} — popraw plik ręcznie, nie nadpisuję go` }
  const sciezka = join(projekt, PLIK_USTAWIEN)
  mkdirSync(dirname(sciezka), { recursive: true })
  writeFileSync(sciezka, `${JSON.stringify({ ...dane, recenzjaPr: tryb }, null, 2)}\n`)
  return trybRecenzji(projekt)
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /** @type {{ projekt?: string, ustaw?: string }} */
  let o = {}
  try {
    o = parseArgs({ options: { projekt: { type: 'string' }, ustaw: { type: 'string' } } }).values
    if (o.ustaw !== undefined && o.ustaw !== 'bot' && o.ustaw !== 'bez-bota') throw new Error(`--ustaw ${o.ustaw}: dozwolone ${TRYBY_RECENZJI.join(', ')}`)
  } catch (e) {
    process.stderr.write(`tryb-recenzji: ${e instanceof Error ? e.message : String(e)}\nUzycie: tryb-recenzji.mjs [--ustaw bot|bez-bota] [--projekt <katalog>]\n`)
    process.exit(2)
  }
  const projekt = o.projekt ?? process.cwd()
  const wynik = o.ustaw === 'bot' || o.ustaw === 'bez-bota' ? ustawTrybRecenzji(projekt, o.ustaw) : trybRecenzji(projekt)
  process.stdout.write(`${JSON.stringify({ ...wynik, plikUstawien: PLIK_USTAWIEN })}\n`)
  process.exit(wynik.blad ? 1 : 0)
}

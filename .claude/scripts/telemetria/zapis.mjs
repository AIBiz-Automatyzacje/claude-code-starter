// Zapis telemetrii: jeden plik JSONL na maszyne (decyzja O4), TYLKO dopisywany (appendFileSync), nigdy nadpisywany.
// Deduplikacja przy odczycie: ostatnia wersja per klucz (przeglad D5 §8 pkt 2 — dwie sesje koncza odpowiedz w ciagu 2 s
// w 6,6% przypadkow, wiec poprawnosc nie moze zalezec od sprawdzania kluczy przed zapisem).

import { appendFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { czytajJsonl } from './zrodla.mjs'

export const PLIK_DANYCH = join(homedir(), '.claude', 'telemetry', 'pipeline.jsonl')
export const PLIK_BLEDOW = join(homedir(), '.claude', 'telemetry', 'zbierz-bledy.log')

// Zamek porzucony przez przerwany skan (kill, restart) po tym czasie jest przejmowany — pelny skan trwa ~15 s.
const PORZUCONY_ZAMEK_MS = 10 * 60 * 1000

// Typy, ktorych rekord po zapisie sie nie zmienia (agent skonczyl prace). Run, faza i skill dostaja nowa wersje przy zmianie.
const TYPY_JEDNORAZOWE = new Set(['agent'])

/** @typedef {Record<string, unknown> & { klucz: string, typ: string }} Rekord */

/**
 * @param {string} plik
 * @returns {{ ostatnie: Map<string, Record<string, unknown>>, uszkodzone: number }}
 */
export function odczytajRekordy(plik) {
  /** @type {Map<string, Record<string, unknown>>} */
  const ostatnie = new Map()
  if (!existsSync(plik)) return { ostatnie, uszkodzone: 0 }
  const { wpisy, uszkodzone } = czytajJsonl(plik)
  for (const w of wpisy) if (typeof w.klucz === 'string') ostatnie.set(w.klucz, w)
  return { ostatnie, uszkodzone }
}

/** @param {Record<string, unknown>} r */
const bezCzasu = (r) => JSON.stringify({ ...r, ts: null })

/**
 * Rekordy, ktore trzeba dopisac: nowy klucz albo (poza agentem) zmieniona tresc wzgledem ostatniej wersji.
 * @param {Rekord[]} rekordy
 * @param {Map<string, Record<string, unknown>>} ostatnie
 * @returns {Rekord[]}
 */
export function doZapisu(rekordy, ostatnie) {
  return rekordy.filter((r) => {
    const poprzedni = ostatnie.get(r.klucz)
    if (!poprzedni) return true
    return !TYPY_JEDNORAZOWE.has(r.typ) && bezCzasu(poprzedni) !== bezCzasu(r)
  })
}

/**
 * Jedno dopisanie na partie rekordow.
 * @param {string} plik
 * @param {Rekord[]} rekordy
 * @returns {number} liczba dopisanych
 */
export function dopisz(plik, rekordy) {
  if (!rekordy.length) return 0
  mkdirSync(dirname(plik), { recursive: true })
  appendFileSync(plik, rekordy.map((r) => JSON.stringify(r)).join('\n') + '\n')
  return rekordy.length
}

/**
 * Wykonuje prace pod zamkiem-katalogiem obok pliku. Zamek to oszczednosc pracy (dwa skany nie licza tego samego),
 * nie warunek poprawnosci — ta wynika z deduplikacji przy odczycie. Zajety zamek = null (skan odpuszcza).
 * @template T
 * @param {string} plik
 * @param {() => T} praca
 * @returns {T | null}
 */
export function zZamkiem(plik, praca) {
  const zamek = `${plik}.zamek`
  mkdirSync(dirname(plik), { recursive: true })
  if (existsSync(zamek) && Date.now() - statSync(zamek).mtimeMs > PORZUCONY_ZAMEK_MS) rmSync(zamek, { recursive: true, force: true })
  try {
    mkdirSync(zamek)
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'EEXIST') return null
    throw e
  }
  try {
    return praca()
  } finally {
    rmSync(zamek, { recursive: true, force: true })
  }
}

/**
 * Blad skanu do logu (hook nie moze niczego wypisac ani zatrzymac sesji).
 * @param {string} plikBledow
 * @param {string} gdzie
 * @param {unknown} blad
 */
export function zapiszBlad(plikBledow, gdzie, blad) {
  const opis = blad instanceof Error ? `${blad.message}\n${blad.stack ?? ''}` : String(blad)
  mkdirSync(dirname(plikBledow), { recursive: true })
  appendFileSync(plikBledow, `${new Date().toISOString()} [${gdzie}] ${opis}\n`)
}

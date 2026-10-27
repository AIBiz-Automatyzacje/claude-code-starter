// Zapis telemetrii: jeden plik JSONL na maszyne (decyzja O4), TYLKO dopisywany (appendFileSync), nigdy nadpisywany.
// Deduplikacja przy odczycie: ostatnia wersja per klucz (pola wersji maszynerii z pierwszej — POLA_ZAMROZONE) (przeglad D5 §8 pkt 2 — dwie sesje koncza odpowiedz w ciagu 2 s
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
  for (const w of wpisy) {
    if (typeof w.klucz !== 'string') continue
    const poprzedni = ostatnie.get(w.klucz)
    ostatnie.set(w.klucz, poprzedni ? zZamrozonymi(w, poprzedni) : w)
  }
  return { ostatnie, uszkodzone }
}

// Pola wersji maszynerii liczone z plikow projektu w chwili skanu: ponowny skan po sync-template wpisywal stan z dnia skanu
// (E5-17). Obowiazuje pierwsza znana wartosc klucza; null = nie wyliczono, wiec bierze nastepna.
const POLA_ZAMROZONE = ['szablon', 'instrukcje_stale']

/** @param {unknown} x @returns {Record<string, unknown> | null} */
const obiektLubNull = (x) => (x !== null && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x)) : null)

/**
 * Ucieczka watku bota (run.pr.klasy[].ucieczka, E5-20) z pierwszej wersji, w ktorej byla ustalona: ponowny skan po podbiciu
 * WERSJA_REKORDU liczy blame od nowa, a po squash-merge'u i gc czubka PR juz nie ma (recenzja S4).
 * @param {unknown} nowyPr @param {unknown} poprzedniPr @returns {unknown}
 */
function zZamrozonymiUcieczkami(nowyPr, poprzedniPr) {
  const nowy = obiektLubNull(nowyPr)
  const poprzedni = obiektLubNull(poprzedniPr)
  if (!nowy || !poprzedni || !Array.isArray(nowy.klasy) || !Array.isArray(poprzedni.klasy)) return nowyPr
  /** @type {Map<unknown, unknown>} */
  const ustalone = new Map()
  for (const k of poprzedni.klasy.map(obiektLubNull)) {
    const u = obiektLubNull(k?.ucieczka)
    if (k && u && u.kubelek !== 'nieustalone') ustalone.set(k.id, k.ucieczka)
  }
  return { ...nowy, klasy: nowy.klasy.map((k) => {
    const klasa = obiektLubNull(k)
    return klasa && ustalone.has(klasa.id) ? { ...klasa, ucieczka: ustalone.get(klasa.id) } : k
  }) }
}

/** @param {Record<string, unknown>} nowy @param {Record<string, unknown>} poprzedni @returns {Record<string, unknown>} */
function zZamrozonymi(nowy, poprzedni) {
  const wynik = { ...nowy }
  for (const pole of POLA_ZAMROZONE) {
    if (poprzedni[pole] !== null && poprzedni[pole] !== undefined) wynik[pole] = poprzedni[pole]
  }
  if (nowy.typ === 'run') wynik.pr = zZamrozonymiUcieczkami(nowy.pr, poprzedni.pr)
  return wynik
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
    // Nowsza wersja logiki wyliczania (pole v) nadpisuje przy odczycie takze rekordy jednorazowe.
    if (poprzedni.v !== r.v) return true
    // Pola zamrozone i tak wygrywaja z pierwszej wersji — ich zmiana nie jest nowa wersja.
    return !TYPY_JEDNORAZOWE.has(r.typ) && bezCzasu(poprzedni) !== bezCzasu(zZamrozonymi(r, poprzedni))
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

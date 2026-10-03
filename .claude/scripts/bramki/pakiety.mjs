// Pakiety monorepo w fazie: bramki biegna w korzeniu projektu i w kazdym pakiecie (najblizszy package.json zmienionego
// pliku), ktory ma wlasne narzedzie bramek — np. pakiet workspace z wlasnym ESLint i Strykerem, gdy migracje leza w korzeniu.
// Wyniki scalone w jeden na bramke, sciezki trafien od korzenia projektu (ta sama postac, co dla projektu bez pakietow).

import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { wykryjNarzedzia } from './narzedzia.mjs'

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {import('./uruchom.mjs').Trafienie} Trafienie */

// Od najwazniejszego: porazka wymaga naprawy, blad — diagnozy; brak i pominieta tylko, gdy nigdzie nie bylo przebiegu.
/** @type {WynikBramki['status'][]} */
const PRIORYTET_STATUSU = ['porazka', 'blad', 'ok', 'brak', 'pominieta']

/**
 * @param {string} projekt
 * @param {string[]} pliki zmienione w fazie, wzgledem projektu
 * @returns {string[]} katalogi pakietow (bez korzenia), posortowane
 */
export function pakietyFazy(projekt, pliki) {
  const pakiety = new Set()
  for (const plik of pliki) {
    let katalog = dirname(plik)
    while (katalog !== '.' && !existsSync(join(projekt, katalog, 'package.json'))) katalog = dirname(katalog)
    if (katalog !== '.') pakiety.add(katalog)
  }
  return [...pakiety].filter((k) => Object.values(wykryjNarzedzia(join(projekt, k))).some((n) => n.jest)).sort()
}

/** @param {string} katalog @param {Trafienie[]} trafienia @returns {Trafienie[]} */
function odKorzenia(katalog, trafienia) {
  return trafienia.map((t) => ({ ...t, plik: t.plik !== null && katalog !== '.' ? join(katalog, t.plik) : t.plik }))
}

/** @param {Trafienie[]} trafienia @returns {Trafienie[]} bez powtorzen (korzen i pakiet widza ten sam diff testow) */
function bezDuplikatow(trafienia) {
  const klucze = new Set()
  return trafienia.filter((t) => {
    const klucz = JSON.stringify([t.plik, t.linia, t.regula, t.opis])
    if (klucze.has(klucz)) return false
    klucze.add(klucz)
    return true
  })
}

/**
 * @param {[string, WynikBramki][]} przebiegi katalog -> wynik jednej bramki
 * @returns {WynikBramki}
 */
function scalBramke(przebiegi) {
  const wyniki = przebiegi.map(([, w]) => w)
  const status = PRIORYTET_STATUSU.find((s) => wyniki.some((w) => w.status === s)) ?? 'brak'
  const sekundy = wyniki.some((w) => w.sekundy !== null) ? wyniki.reduce((suma, w) => suma + (w.sekundy ?? 0), 0) : null
  /** @type {WynikBramki} */
  const wynik = {
    status,
    sekundy: sekundy === null ? null : Math.round(sekundy * 10) / 10,
    trafienia: bezDuplikatow(przebiegi.flatMap(([k, w]) => odKorzenia(k, w.trafienia))),
  }
  if (wyniki.some((w) => w.ostrzezenia)) wynik.ostrzezenia = przebiegi.flatMap(([k, w]) => odKorzenia(k, w.ostrzezenia ?? []))
  if (wyniki.some((w) => w.zastane !== undefined)) wynik.zastane = wyniki.reduce((suma, w) => suma + (w.zastane ?? 0), 0)
  const powody = przebiegi.flatMap(([k, w]) => (w.powod ? [`${k}: ${w.powod}`] : []))
  if (powody.length) wynik.powod = powody.join('; ')
  return wynik
}

/**
 * @param {[string, Record<string, WynikBramki>][]} przebiegi katalog (wzgledem projektu, '.' = korzen) -> wynik bramek
 * @returns {Record<string, WynikBramki>}
 */
export function scalWyniki(przebiegi) {
  const nazwy = [...new Set(przebiegi.flatMap(([, w]) => Object.keys(w)))]
  return Object.fromEntries(nazwy.map((n) => [n, scalBramke(przebiegi.flatMap(([k, w]) => (w[n] ? [[k, w[n]]] : [])))]))
}

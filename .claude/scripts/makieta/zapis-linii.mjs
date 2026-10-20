// Zapis decyzji operatora do jednej linii checklisty smoke'u (P24 IU-3). Sesja smoke'u i narzedzie pisza do tego samego pliku:
// sesje chroni Edit (odmawia przy zmianie od odczytu), narzedzie — porownanie linii. Zapis podaje identyfikator punktu i linie,
// ktora widzial operator; plik czytamy od nowa, linia inna = konflikt bez zapisu (strona odswieza punkty), zgodna = podmiana
// tylko tej linii, reszta pliku bajt w bajt (takze konce linii). Plik tymczasowy w katalogu smoke'u i `rename` (atomowo w obrebie
// systemu plikow); zapisy narzedzia (serwer i CLI) serializuje blokada `open(…,'wx')` w katalogu stanu.
//
// Notatki operatora trafiaja do checkboxa, ktory czytaja grepy pipeline'u: jedna linia, bez otwarcia i zamkniecia adnotacji,
// znaczniki scenariuszy i priorytetow w nawiasach kwadratowych oraz „Operator” z dwukropkiem zneutralizowane.

import { createHash, randomUUID } from 'node:crypto'
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { setTimeout as czekaj } from 'node:timers/promises'

import { ZNACZNIK_BLEDU, ZNACZNIK_ODSTEPSTWA, ZNACZNIK_POPRAWKI, punktyWizualne } from './punkty.mjs'

const DLUGOSC_NOTATKI = 300
const DLUGOSC_URZADZENIA = 40
const MAKS_SZEROKOSC = 10_000
const WIEK_PRZETERMINOWANEJ_MS = 10_000
const LIMIT_BLOKADY_MS = 3000
const ODSTEP_BLOKADY_MS = 50
const PLIK_BLOKADY = 'zapis.lock'
const SHA = /^[0-9a-f]{4,40}$/

/**
 * @typedef {'zgodne' | 'odstepstwo' | 'blad' | 'poprawione'} Decyzja
 * @typedef {{ notatka?: string, urzadzenie?: string, szerokosc?: number, commit?: string }} DaneDecyzji
 * @typedef {{ wynik: 'zapisano', linia: string } | { wynik: 'konflikt', powod: 'brak-punktu' | 'niejednoznaczny' | 'linia-zmieniona', linia: string | null }} WynikZapisu
 */

export class BladZapisu extends Error {
  /** @param {'odmowa' | 'blokada'} kod @param {string} komunikat */
  constructor(kod, komunikat) {
    super(komunikat)
    this.name = 'BladZapisu'
    this.kod = kod
  }
}

/** @param {string} tekst @returns {string} skrot SHA-1 hex — identyfikator punktu w punkty.mjs */
export const skrotSha1 = (tekst) => createHash('sha1').update(tekst).digest('hex')

/**
 * Notatka operatora jako fragment jednej linii checkboxa.
 * @param {string} tekst
 * @param {number} [limit]
 * @returns {string}
 */
export function oczyscNotatke(tekst, limit = DLUGOSC_NOTATKI) {
  return String(tekst)
    .replace(/\s+/g, ' ')
    .replaceAll('*(', '(')
    .replaceAll(')*', ')')
    .replace(/\[(E2E|Manual|Unit|P[1-3])\]/gi, '$1')
    .replace(/\bOperator:/gi, 'Operator')
    .trim()
    .slice(0, limit)
    .trim()
}

/** @param {Date} d @returns {string} data lokalna RRRR-MM-DD (nie UTC: po polnocy w Polsce UTC ma jeszcze wczorajsza) */
function dataLokalna(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Checkbox i tresc adnotacji decyzji; pusta notatka odstepstwa, pusty opis bledu, zla szerokosc albo commit = odmowa.
 * @param {Decyzja} decyzja
 * @param {DaneDecyzji} dane
 * @returns {{ checkbox: ' ' | 'x', tresc: string }}
 */
function adnotacjaDecyzji(decyzja, dane) {
  if (decyzja === 'zgodne') return { checkbox: 'x', tresc: 'zgodne' }
  if (decyzja === 'odstepstwo') {
    const notatka = oczyscNotatke(dane.notatka ?? '')
    if (!notatka) throw new BladZapisu('odmowa', '„Odstępstwo OK” wymaga notatki: co się różni i dlaczego to OK')
    return { checkbox: 'x', tresc: `${notatka} ${ZNACZNIK_ODSTEPSTWA}` }
  }
  if (decyzja === 'blad') {
    const opis = oczyscNotatke(dane.notatka ?? '')
    const urzadzenie = oczyscNotatke(dane.urzadzenie ?? '', DLUGOSC_URZADZENIA)
    const { szerokosc } = dane
    if (!opis) throw new BladZapisu('odmowa', '„Zgłoś błąd” wymaga opisu: co jest nie tak')
    if (!urzadzenie || typeof szerokosc !== 'number' || !Number.isInteger(szerokosc) || szerokosc < 1 || szerokosc > MAKS_SZEROKOSC) {
      throw new BladZapisu('odmowa', '„Zgłoś błąd” wymaga urządzenia i szerokości ramki (1–10000 px)')
    }
    return { checkbox: ' ', tresc: `${ZNACZNIK_BLEDU} — ${urzadzenie} ${szerokosc} px: ${opis}` }
  }
  if (decyzja === 'poprawione') {
    if (!SHA.test(dane.commit ?? '')) throw new BladZapisu('odmowa', '„poprawione” wymaga skrótu commita (4–40 znaków hex)')
    return { checkbox: ' ', tresc: `${ZNACZNIK_POPRAWKI} w ${dane.commit}, do sprawdzenia` }
  }
  throw new BladZapisu('odmowa', `nieznana decyzja „${String(decyzja)}” (zgodne, odstepstwo, blad, poprawione)`)
}

/**
 * Plik zapisany atomowo: tymczasowy obok celu (`open 'wx'`, `fsync`), potem `rename`; przy bledzie tymczasowy usuniety.
 * @param {string} plik
 * @param {string} tresc
 * @param {{ rename?: (z: string, na: string) => void }} [opcje] rename podmieniany w tescie przerwanego zapisu
 */
export function zapiszAtomowo(plik, tresc, { rename = renameSync } = {}) {
  const tymczasowy = join(dirname(plik), `.${basename(plik)}.${process.pid}.${randomUUID()}.tmp`)
  try {
    const fd = openSync(tymczasowy, 'wx', statSync(plik).mode)
    try {
      writeSync(fd, tresc)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    rename(tymczasowy, plik)
  } catch (blad) {
    rmSync(tymczasowy, { force: true })
    throw blad
  }
}

/** @param {unknown} blad @param {string} kod @returns {boolean} */
const zKodem = (blad, kod) => blad instanceof Error && 'code' in blad && blad.code === kod

/**
 * Blokada zapisow narzedzia: plik `zapis.lock` z PID-em; przeterminowana (> 10 s) usuwana, swieza — czekanie do limitu.
 * @param {string} katalogStanu
 * @param {number} limitMs
 * @returns {Promise<() => void>} zdjecie blokady
 */
async function zalozBlokade(katalogStanu, limitMs) {
  mkdirSync(katalogStanu, { recursive: true })
  const plik = join(katalogStanu, PLIK_BLOKADY)
  const termin = Date.now() + limitMs
  for (;;) {
    try {
      closeSync(openSync(plik, 'wx'))
      return () => rmSync(plik, { force: true })
    } catch (blad) {
      if (!zKodem(blad, 'EEXIST')) throw blad
    }
    let wiek = 0
    try {
      wiek = Date.now() - statSync(plik).mtimeMs
    } catch (blad) {
      // Blokade zdjal inny zapis miedzy open a stat — nastepna proba ja zalozy.
      if (!zKodem(blad, 'ENOENT')) throw blad
    }
    if (wiek > WIEK_PRZETERMINOWANEJ_MS) rmSync(plik, { force: true })
    else if (Date.now() > termin) throw new BladZapisu('blokada', `inny zapis narzędzia trzyma blokadę ${plik} — spróbuj za chwilę`)
    else await czekaj(ODSTEP_BLOKADY_MS)
  }
}

/**
 * Decyzja operatora w linii punktu: nowa adnotacja zaraz po checkboxie, przed starymi; konflikt bez zapisu, gdy punktu nie ma,
 * wystepuje kilka razy albo jego linia rozni sie od tej, ktora widzial operator.
 * @param {{ plik: string, katalogStanu: string, punkt: string, linia: string, decyzja: Decyzja, teraz?: Date, limitBlokadyMs?: number } & DaneDecyzji} o
 * @returns {Promise<WynikZapisu>}
 */
export async function zapiszDecyzje({ plik, katalogStanu, punkt, linia, decyzja, teraz = new Date(), limitBlokadyMs = LIMIT_BLOKADY_MS, ...dane }) {
  const { checkbox, tresc } = adnotacjaDecyzji(decyzja, dane)
  const zdejmij = await zalozBlokade(katalogStanu, limitBlokadyMs)
  try {
    const md = readFileSync(plik, 'utf8')
    const trafienia = punktyWizualne(md, skrotSha1).filter((p) => p.id === punkt)
    if (!trafienia.length) return { wynik: 'konflikt', powod: 'brak-punktu', linia: null }
    if (trafienia.length > 1 || trafienia[0].niejednoznaczny) return { wynik: 'konflikt', powod: 'niejednoznaczny', linia: null }
    const p = trafienia[0]
    if (p.tekst !== linia) return { wynik: 'konflikt', powod: 'linia-zmieniona', linia: p.tekst }
    const reszta = p.tekst.slice('- [ ] '.length)
    const nowa = `- [${checkbox}] *(${dataLokalna(teraz)}: ${tresc})* ${reszta}`
    const linie = md.split('\n')
    linie[p.linia - 1] = linie[p.linia - 1].endsWith('\r') ? `${nowa}\r` : nowa
    zapiszAtomowo(plik, linie.join('\n'))
    return { wynik: 'zapisano', linia: nowa }
  } finally {
    zdejmij()
  }
}

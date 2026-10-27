// Zapis decyzji operatora do jednej linii checklisty smoke'u (P24 IU-3). Sesja smoke'u i narzedzie pisza do tego samego pliku:
// sesje chroni Edit (odmawia przy zmianie od odczytu), narzedzie — porownanie linii. Zapis podaje identyfikator punktu i linie,
// ktora widzial operator; plik czytamy od nowa, linia inna = konflikt bez zapisu (strona odswieza punkty), zgodna = podmiana
// tylko tej linii, reszta pliku bajt w bajt (takze konce linii). Plik tymczasowy w katalogu smoke'u i `rename` (atomowo w obrebie
// systemu plikow); zapisy narzedzia (serwer i CLI) serializuje blokada `open(…,'wx')` w katalogu stanu.
//
// Notatki operatora trafiaja do checkboxa, ktory czytaja grepy pipeline'u: jedna linia, bez otwarcia i zamkniecia adnotacji,
// znaczniki scenariuszy i priorytetow w nawiasach kwadratowych oraz „Operator” z dwukropkiem zneutralizowane.

import { createHash, randomUUID } from 'node:crypto'
import { closeSync, fchmodSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { setTimeout as czekaj } from 'node:timers/promises'

import { ZNACZNIK_BLEDU, ZNACZNIK_ODSTEPSTWA, ZNACZNIK_POPRAWKI, ZNACZNIK_ZRZUTU, punktyWizualne } from './punkty.mjs'

const DLUGOSC_NOTATKI = 300
const DLUGOSC_URZADZENIA = 40
const MAKS_SZEROKOSC = 10_000
const WIEK_PRZETERMINOWANEJ_MS = 10_000
const LIMIT_BLOKADY_MS = 3000
const ODSTEP_BLOKADY_MS = 50
const PLIK_BLOKADY = 'zapis.lock'
const SHA = /^[0-9a-f]{4,40}$/
// Sciezka zrzutu sprawdzona przez serwer (katalog zadania, punkt, plik istnieje) — tu tylko znaki bezpieczne w adnotacji.
const ZRZUT = /^[\w./-]+\.png$/

/**
 * @typedef {'zgodne' | 'odstepstwo' | 'blad' | 'poprawione'} Decyzja
 * @typedef {{ notatka?: string, urzadzenie?: string, szerokosc?: number, commit?: string, zrzut?: string }} DaneDecyzji
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

/** @param {string} t @returns {string} jedno przejscie neutralizacji; `**(x)**` po jednym przejsciu daje `*(x)*`, wiec wolajacy powtarza */
const neutralizuj = (t) => t
  .replace(/\s+/g, ' ')
  .replace(/\*+\(/g, '(')
  .replace(/\)\*+/g, ')')
  .replace(/\[+\s*(E2E|Manual|Unit|P[1-3])\s*\]+/gi, '$1')
  .replace(/(Operator)\s*:+/gi, '$1')
  // Znacznik sciezki zrzutu (P27 S3) stawia tylko narzedzie — notatka nie podszyje sie pod zrzut w `opisOtwartych`.
  .replace(/·\s*(zrzut)\s*:+/gi, '· $1 ')

/**
 * Notatka operatora jako fragment jednej linii checkboxa: neutralizacja do punktu stalego (resztki nie skladaja sie w nowe
 * zamkniecie adnotacji ani token grepa), limit w znakach Unicode (bez przecinania par zastepczych).
 * @param {unknown} tekst
 * @param {number} [limit]
 * @returns {string} pusty tekst dla wartosci innej niz string
 */
export function oczyscNotatke(tekst, limit = DLUGOSC_NOTATKI) {
  if (typeof tekst !== 'string') return ''
  let t = tekst
  for (let poprzedni = ''; poprzedni !== t;) {
    poprzedni = t
    t = neutralizuj(t)
  }
  return Array.from(t.trim()).slice(0, limit).join('').trim()
}

/** @param {Date} d @returns {string} data lokalna RRRR-MM-DD (nie UTC: po polnocy w Polsce UTC ma jeszcze wczorajsza) */
export function dataLokalna(d) {
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
    if (dane.zrzut !== undefined && !ZRZUT.test(dane.zrzut)) throw new BladZapisu('odmowa', 'ścieżka zrzutu spoza visual-diff/zgloszenia/')
    return { checkbox: ' ', tresc: `${ZNACZNIK_BLEDU} — ${urzadzenie} ${szerokosc} px: ${opis}${dane.zrzut ? `${ZNACZNIK_ZRZUTU}${dane.zrzut}` : ''}` }
  }
  if (decyzja === 'poprawione') {
    if (typeof dane.commit !== 'string' || !SHA.test(dane.commit)) throw new BladZapisu('odmowa', '„poprawione” wymaga skrótu commita (4–40 znaków hex)')
    return { checkbox: ' ', tresc: `${ZNACZNIK_POPRAWKI} w ${dane.commit}, do sprawdzenia` }
  }
  throw new BladZapisu('odmowa', `nieznana decyzja „${String(decyzja)}” (zgodne, odstepstwo, blad, poprawione)`)
}

/**
 * Plik zapisany atomowo: tymczasowy obok celu (`open 'wx'`, tryb celu bez umask, `fsync`), potem `rename`; przy bledzie
 * tymczasowy usuniety. Dowiazanie symboliczne: zapis do celu dowiazania (rename na dowiazaniu zastapilby je zwyklym plikiem).
 * @param {string} plik
 * @param {string} tresc
 * @param {{ rename?: (z: string, na: string) => void }} [opcje] rename podmieniany w tescie przerwanego zapisu
 */
export function zapiszAtomowo(plik, tresc, { rename = renameSync } = {}) {
  const cel = realpathSync(plik)
  const tymczasowy = join(dirname(cel), `.${basename(cel)}.${process.pid}.${randomUUID()}.tmp`)
  try {
    const fd = openSync(tymczasowy, 'wx')
    try {
      fchmodSync(fd, statSync(cel).mode & 0o7777)
      writeSync(fd, tresc)
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    rename(tymczasowy, cel)
  } catch (blad) {
    rmSync(tymczasowy, { force: true })
    throw blad
  }
}

/** @param {unknown} blad @param {string} kod @returns {boolean} */
const zKodem = (blad, kod) => blad instanceof Error && 'code' in blad && blad.code === kod

/** @param {string} plik @returns {string | null} tresc blokady (token wlasciciela) albo null, gdy jej nie ma */
function tokenBlokady(plik) {
  try {
    return readFileSync(plik, 'utf8')
  } catch (blad) {
    if (zKodem(blad, 'ENOENT')) return null
    throw blad
  }
}

/**
 * Przeterminowana blokada przejmowana przez rename na nazwe unikalna: z dwoch procesow, ktore zobaczyly ja jednoczesnie, tylko
 * jeden ja przeniesie — drugi nie usunie swiezej blokady pierwszego.
 * @param {string} plik
 */
function przejmijPrzeterminowana(plik) {
  const przeniesiona = `${plik}.${randomUUID()}.stara`
  try {
    renameSync(plik, przeniesiona)
  } catch (blad) {
    if (zKodem(blad, 'ENOENT')) return
    throw blad
  }
  // Miedzy stat a rename ktos mogl przejac stara i zalozyc swieza — swieza wraca na miejsce.
  if (Date.now() - statSync(przeniesiona).mtimeMs <= WIEK_PRZETERMINOWANEJ_MS) renameSync(przeniesiona, plik)
  else rmSync(przeniesiona, { force: true })
}

/**
 * Blokada zapisow narzedzia: plik `zapis.lock` z tokenem wlasciciela; przeterminowana (> 10 s) przejmowana, swieza — czekanie
 * do limitu. Zdjecie usuwa plik tylko z wlasnym tokenem.
 * @param {string} katalogStanu
 * @param {number} [limitMs]
 * @returns {Promise<() => void>} zdjecie blokady
 */
export async function zalozBlokade(katalogStanu, limitMs = LIMIT_BLOKADY_MS) {
  const plik = join(katalogStanu, PLIK_BLOKADY)
  const token = `${process.pid}.${randomUUID()}`
  const termin = Date.now() + limitMs
  for (;;) {
    mkdirSync(katalogStanu, { recursive: true })
    try {
      const fd = openSync(plik, 'wx')
      writeSync(fd, token)
      closeSync(fd)
      return () => {
        if (tokenBlokady(plik) === token) rmSync(plik, { force: true })
      }
    } catch (blad) {
      if (!zKodem(blad, 'EEXIST')) throw blad
    }
    /** @type {number | null} */
    let wiek = null
    try {
      wiek = Date.now() - statSync(plik).mtimeMs
    } catch (blad) {
      // Blokade zdjal inny zapis miedzy open a stat — nastepna proba ja zalozy.
      if (!zKodem(blad, 'ENOENT')) throw blad
    }
    if (wiek === null) continue
    if (wiek > WIEK_PRZETERMINOWANEJ_MS) przejmijPrzeterminowana(plik)
    else if (Date.now() > termin) throw new BladZapisu('blokada', `inny zapis narzędzia trzyma blokadę ${plik} — ponów za chwilę`)
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
    if (trafienia[0].niejednoznaczny) return { wynik: 'konflikt', powod: 'niejednoznaczny', linia: null }
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

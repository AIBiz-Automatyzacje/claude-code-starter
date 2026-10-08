// Kategorie pomiaru ogrodnika (PLAN-POPRAWY P15): wzorce, ktore agenci kopiuja z kodu projektu jako „istniejacy wzorzec”.
// Wyciszenia i komentarze-obejscia szukane w komentarzach, reszta w kodzie z wygaszonymi stringami (leksyka.mjs).
// Komentarze-obejscia to kategoria pomiaru zamiast zakazu komentarzy (INSPIRACJE B8).

import { rozbierz } from './leksyka.mjs'

/** @typedef {'wyciszenia' | 'any' | 'rzutowania' | 'komentarze' | 'pusty_catch'} Kategoria */
/** @typedef {{ kategoria: Kategoria, plik: string, linia: number, tekst: string }} Wystapienie */

/** @type {Kategoria[]} */
export const KATEGORIE = ['wyciszenia', 'any', 'rzutowania', 'komentarze', 'pusty_catch']

export const OPISY = {
  wyciszenia: 'wyciszenia lint/TS',
  any: 'any',
  rzutowania: 'wymuszone rzutowania',
  komentarze: 'komentarze-obejscia',
  pusty_catch: 'puste catch',
}

const PLIK_TS = /\.(ts|tsx|mts|cts)$/

// Dyrektywa dziala tylko na poczatku komentarza — wzmianka w tresci („`@ts-expect-error` zamiast rzutu”) nie wycisza niczego.
const WYCISZENIE = /^[\s*]*(?:eslint-disable(?:-next-line|-line)?\b|@ts-(?:ignore|expect-error|nocheck)\b|biome-ignore\b|oxlint-disable\b)/
// Znaczniki wielkimi literami (male „todo” to czesto domena: lista zadan); slowa obejscia bez wzgledu na wielkosc.
// „Obejscie” po polsku to tez „bypass” (obejscie limitu, luka do obejscia — 13 z 15 trafien w oferty-online), wiec liczy
// sie tylko w orzeczeniu o kodzie („jako/to/jest/bylo obejscie”).
const ZNACZNIK = /\b(?:TODO|FIXME|HACK|XXX)\b/
const SLOWO_OBEJSCIA = /\b(?:workaround|work-around|tymczasow|temporar)|\b(?:jako|to|jest|by[lł][oa]?|tymczasowe|na)\s+obej[sś]ci/i

// Typ `any` w pozycji typu: po `:`, `<`, `>` (`=> any`), `[`, `,`, `|`, `&`, `(`, `=` (alias typu) albo `as`. `z.any()` i `.any` nie lapia (kropka).
const ANY = /(?<=(?:[:<>[,|&(=]|\bas)\s*)any(?![\w$])/g
// Podwojne rzutowanie, `as never` i nie-null `x!.` / `x![` / `x!)` (coding-rules „Type safety”: zamiast `as` i `!` — zawezenie).
const RZUTOWANIE = /\bas\s+unknown\s+as\b|\bas\s+never\b|(?<=[\w$)\]])!(?=[.[)])/g
const PUSTY_CATCH = /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}|\.catch\(\s*(?:\([^)]*\)|[\w$]+)\s*=>\s*(?:\{\s*\}|undefined|null|void 0)\s*\)/g

/**
 * Numer linii (od 1) dla offsetu w tekscie; `poczatki` = offsety poczatkow linii.
 * @param {number[]} poczatki
 * @param {number} offset
 * @returns {number}
 */
function liniaOffsetu(poczatki, offset) {
  let lo = 0
  let hi = poczatki.length - 1
  while (lo < hi) {
    const sr = (lo + hi + 1) >> 1
    if (poczatki[sr] <= offset) lo = sr
    else hi = sr - 1
  }
  return lo + 1
}

/**
 * Wystapienia wszystkich kategorii w jednym pliku.
 * @param {string} tekst
 * @param {string} plik sciezka wzgledna (rozszerzenie decyduje o kategoriach typow)
 * @returns {Wystapienie[]}
 */
export function wystapienia(tekst, plik) {
  const { kod, komentarze } = rozbierz(tekst)
  const linie = tekst.split('\n')
  const poczatki = [0]
  for (let i = 0; i < tekst.length; i++) if (tekst[i] === '\n') poczatki.push(i + 1)
  /** @type {Wystapienie[]} */
  const wynik = []
  const dodaj = (/** @type {Kategoria} */ kategoria, /** @type {number} */ linia) =>
    wynik.push({ kategoria, plik, linia, tekst: (linie[linia - 1] ?? '').trim().slice(0, 160) })
  for (const k of komentarze) {
    if (WYCISZENIE.test(k.tekst)) dodaj('wyciszenia', k.linia)
    if (ZNACZNIK.test(k.tekst) || SLOWO_OBEJSCIA.test(k.tekst)) dodaj('komentarze', k.linia)
  }
  /** @type {Array<[Kategoria, RegExp]>} */
  const wzorceKodu = [['pusty_catch', PUSTY_CATCH]]
  if (PLIK_TS.test(plik)) wzorceKodu.push(['any', ANY], ['rzutowania', RZUTOWANIE])
  for (const [kategoria, wzorzec] of wzorceKodu) {
    for (const m of kod.matchAll(wzorzec)) dodaj(kategoria, liniaOffsetu(poczatki, m.index))
  }
  return wynik.sort((a, b) => a.linia - b.linia || KATEGORIE.indexOf(a.kategoria) - KATEGORIE.indexOf(b.kategoria))
}

/**
 * @param {Wystapienie[]} lista
 * @returns {Record<Kategoria, number>}
 */
export function policz(lista) {
  const liczby = /** @type {Record<Kategoria, number>} */ (Object.fromEntries(KATEGORIE.map((k) => [k, 0])))
  for (const w of lista) liczby[w.kategoria]++
  return liczby
}

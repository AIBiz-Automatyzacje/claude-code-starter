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

// Linia kodu w wystapieniu (do odczytu przez czlowieka) — dluzsze linie przycinane.
const DLUGOSC_TEKSTU = 160

const PLIK_TS = /\.(ts|tsx|mts|cts)$/

// Dyrektywa dziala tylko na poczatku komentarza (pierwsza linia bloku) — wzmianka w tresci albo w srodku JSDoc nic nie wycisza.
// Deno lint (Edge Functions Supabase) i konfiguracja reguly w komentarzu (`/* eslint no-console: off */`) tez wyciszaja.
const WYCISZENIE = /^[\s*]*(?:eslint-disable(?:-next-line|-line)?\b|@ts-(?:ignore|expect-error|nocheck)\b|biome-ignore\b|oxlint-disable\b|deno-lint-ignore(?:-file)?\b|eslint\s+[\w@/-]+\s*:\s*["']?(?:0|off)\b)/
// Znaczniki wielkimi literami (male „todo” to czesto domena: lista zadan); XXX tylko na poczatku komentarza („+48 XXX XXX XXX”
// to format telefonu).
const ZNACZNIK = /\b(?:TODO|FIXME|HACK)\b|^[\s*]*XXX\b/
// Slowa obejscia tylko w orzeczeniu o kodzie: „plik tymczasowy”, „zgoda tymczasowa”, „luka do obejscia limitu” (bypass) to
// slownictwo dziedziny — w projektach z ~/Documents/Kodowanie ~31 z 34 trafien samego rdzenia „tymczasow/temporar”.
const SLOWO_OBEJSCIA = new RegExp([
  String.raw`\b(?:workaround|work-around)\b`,
  String.raw`\b(?:jako|to|jest|by[lł][oa]?|tymczasowe)\s+obej[sś]ci`,
  String.raw`\btymczasow\w*\s+(?:obej[sś]|rozwi[aą]z|hack|[lł]at|wy[lł][aą]cz|pomij|zakomentow|wyciszon)`,
  String.raw`\btemporar\w*\s+(?:fix|workaround|hack|hotfix|solution)`,
].join('|'), 'i')

// Typ `any` w pozycji typu: po `:`, `<`, `>` (`=> any`), `[`, `,`, `|`, `&`, `(`, `=` (alias typu), `as`, `keyof`, `readonly`,
// `extends`; za nim koniec typu albo `as` (`x as any as Foo`). `z.any()` i `.any` nie lapia (kropka), wyrazenie `= any + 1` tez nie.
const ANY = /(?<=(?:[:<>[,|&(=]|\b(?:as|keyof|readonly|extends))\s*)any(?![\w$])(?=\s*(?:[\]>)|,;=&{}?]|\[\]|\bas\b|$))/gm
// Podwojne rzutowanie, `as never` i nie-null `x!` (coding-rules „Type safety”: zamiast `as` i `!` — zawezenie): przed kropka,
// nawiasem, przecinkiem, srednikiem, dwukropkiem, `??`, `&&`, `||` albo koncem linii. `!=` / `!==` to porownanie.
const RZUTOWANIE_TS = /\bas\s+unknown\s+as\b|\bas\s+never\b|(?<=[\w$)\]])!(?!=)(?=\s*(?:[.[),;:}\]]|\?\?|&&|\|\||$))/gm
// W TSX koniec linii po `!` to zwykle tekst JSX („Zapisano!”), nie asercja — bez tej alternatywy.
const RZUTOWANIE_TSX = /\bas\s+unknown\s+as\b|\bas\s+never\b|(?<=[\w$)\]])!(?!=)(?=\s*(?:[.[),;:}\]]|\?\?|&&|\|\|))/g
const PUSTY_CATCH = /\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}|\.catch\(\s*(?:async\s*)?(?:(?:\([^)]*\)|[\w$]+)\s*=>\s*(?:\{\s*\}|undefined|null|void 0)|function\s*\w*\s*\([^)]*\)\s*\{\s*\})\s*\)/g

/**
 * Numer linii (od 1) dla offsetu w tekscie; `poczatki` = offsety poczatkow linii.
 * @param {number[]} poczatki
 * @param {number} offset
 * @returns {number}
 */
function liniaOffsetu(poczatki, offset) {
  let dol = 0
  let gora = poczatki.length - 1
  while (dol < gora) {
    const srodek = (dol + gora + 1) >> 1
    if (poczatki[srodek] <= offset) dol = srodek
    else gora = srodek - 1
  }
  return dol + 1
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
    wynik.push({ kategoria, plik, linia, tekst: (linie[linia - 1] ?? '').trim().slice(0, DLUGOSC_TEKSTU) })
  for (const komentarz of komentarze) {
    if (komentarz.poczatek && WYCISZENIE.test(komentarz.tekst)) dodaj('wyciszenia', komentarz.linia)
    if (ZNACZNIK.test(komentarz.tekst) || SLOWO_OBEJSCIA.test(komentarz.tekst)) dodaj('komentarze', komentarz.linia)
  }
  /** @type {Array<[Kategoria, RegExp]>} */
  const wzorceKodu = [['pusty_catch', PUSTY_CATCH]]
  if (PLIK_TS.test(plik)) wzorceKodu.push(['any', ANY], ['rzutowania', plik.endsWith('.tsx') ? RZUTOWANIE_TSX : RZUTOWANIE_TS])
  for (const [kategoria, wzorzec] of wzorceKodu) {
    for (const dopasowanie of kod.matchAll(wzorzec)) dodaj(kategoria, liniaOffsetu(poczatki, dopasowanie.index))
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

/**
 * Liczby kategorii z rekordu telemetrii; null, gdy rekord nie ma kompletu liczb calkowitych (uszkodzony albo z innej wersji).
 * @param {unknown} liczby
 * @returns {Record<Kategoria, number> | null}
 */
export function liczbyZRekordu(liczby) {
  if (!liczby || typeof liczby !== 'object' || Array.isArray(liczby)) return null
  const rekord = /** @type {Record<string, unknown>} */ (liczby)
  if (!KATEGORIE.every((k) => Number.isInteger(rekord[k]))) return null
  return /** @type {Record<Kategoria, number>} */ (Object.fromEntries(KATEGORIE.map((k) => [k, rekord[k]])))
}

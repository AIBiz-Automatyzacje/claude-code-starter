// Porownanie z poprzednim pomiarem (rekord `ogrod` runu autopilota w telemetrii) i decyzja o agencie oceny.
// Progi ustalone przy wdrozeniu P15 na historii oferty-online (15 zadan, przyrost 0–12 na zadanie):
// ocena przy nowym wyciszeniu, przy sumie przyrostu pozostalych kategorii >= PROG_PRZYROSTU albo co CO_ILE_POMIAROW pomiarow.

import { odczytajRekordy } from '../telemetria/zapis.mjs'
import { KATEGORIE } from './kategorie.mjs'

// Coding-rules zabraniaja wyciszen w linii, wiec kazde nowe to naruszenie, ktore agenci skopiuja.
export const PROG_WYCISZEN = 1
export const PROG_PRZYROSTU = 5
export const CO_ILE_POMIAROW = 5

/** @typedef {import('./kategorie.mjs').Kategoria} Kategoria */
/** @typedef {{ run: string | null, start: string | null, liczby: Record<Kategoria, number>, bez_oceny: number }} Poprzedni */
/**
 * @typedef {object} Decyzja
 * @property {boolean} ocena
 * @property {string} powod
 * @property {'telemetria' | 'diff'} zrodlo przyrost wzgledem poprzedniego rekordu albo z linii dodanych przez zadanie
 * @property {Record<Kategoria, number>} przyrost
 * @property {number} bez_oceny pomiary bez oceny razem z tym (stan przed ewentualna ocena)
 */

/** @param {unknown} x @returns {Record<string, unknown>} */
const obiekt = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? /** @type {Record<string, unknown>} */ (x) : {})

/**
 * Liczby kategorii z rekordu; null, gdy rekord nie ma kompletu liczb (uszkodzony albo z innej wersji pomiaru).
 * @param {unknown} liczby
 * @returns {Record<Kategoria, number> | null}
 */
export function liczbyZRekordu(liczby) {
  const l = obiekt(liczby)
  if (!KATEGORIE.every((k) => typeof l[k] === 'number' && Number.isFinite(l[k]))) return null
  return /** @type {Record<Kategoria, number>} */ (Object.fromEntries(KATEGORIE.map((k) => [k, l[k]])))
}

/**
 * Ostatni rekord runu autopilota tego projektu z pomiarem ogrodu (po polu `start`).
 * @param {Iterable<Record<string, unknown>>} rekordy
 * @param {string} projekt nazwa projektu jak w telemetrii (basename katalogu)
 * @returns {Poprzedni | null}
 */
export function poprzedniPomiar(rekordy, projekt) {
  /** @type {Poprzedni | null} */
  let najnowszy = null
  for (const r of rekordy) {
    if (r.typ !== 'run' || r.workflow !== 'dev-autopilot' || r.projekt !== projekt) continue
    const ogrod = obiekt(r.ogrod)
    const liczby = liczbyZRekordu(ogrod.liczby)
    if (!liczby) continue
    const start = typeof r.start === 'string' ? r.start : null
    if (najnowszy && (najnowszy.start ?? '') >= (start ?? '')) continue
    const bezOceny = typeof ogrod.bez_oceny === 'number' ? ogrod.bez_oceny : 0
    najnowszy = { run: typeof r.run === 'string' ? r.run : null, start, liczby, bez_oceny: bezOceny }
  }
  return najnowszy
}

/**
 * @param {string} plikTelemetrii
 * @param {string} projekt
 * @returns {Poprzedni | null}
 */
export function poprzedniZPliku(plikTelemetrii, projekt) {
  return poprzedniPomiar(odczytajRekordy(plikTelemetrii).ostatnie.values(), projekt)
}

/**
 * Funkcja progu: bez poprzedniego rekordu przyrost = wystapienia w liniach dodanych przez zadanie.
 * @param {{ liczby: Record<Kategoria, number>, noweLiczby: Record<Kategoria, number>, poprzedni: Poprzedni | null }} we
 * @returns {Decyzja}
 */
export function decyzjaOceny(we) {
  const zrodlo = we.poprzedni ? 'telemetria' : 'diff'
  const przyrost = /** @type {Record<Kategoria, number>} */ (Object.fromEntries(KATEGORIE.map((k) =>
    [k, we.poprzedni ? we.liczby[k] - we.poprzedni.liczby[k] : we.noweLiczby[k]])))
  const bezOceny = (we.poprzedni?.bez_oceny ?? 0) + 1
  const suma = KATEGORIE.filter((k) => k !== 'wyciszenia').reduce((s, k) => s + Math.max(0, przyrost[k]), 0)
  const opisZrodla = zrodlo === 'telemetria' ? 'wzgledem poprzedniego zadania' : 'w liniach dodanych przez zadanie (pierwszy pomiar)'
  /** @type {string[]} */
  const powody = []
  if (przyrost.wyciszenia >= PROG_WYCISZEN) powody.push(`nowe wyciszenia lint/TS: +${przyrost.wyciszenia} ${opisZrodla}`)
  if (suma >= PROG_PRZYROSTU) powody.push(`przyrost pozostalych kategorii: +${suma} ${opisZrodla} (prog ${PROG_PRZYROSTU})`)
  if (bezOceny >= CO_ILE_POMIAROW) powody.push(`przeglad okresowy: ${bezOceny} pomiarow bez oceny (co ${CO_ILE_POMIAROW})`)
  const powod = powody.length
    ? powody.join('; ')
    : `bez oceny: przyrost ponizej progu ${opisZrodla}, ${bezOceny}/${CO_ILE_POMIAROW} pomiarow do przegladu okresowego`
  return { ocena: powody.length > 0, powod, zrodlo, przyrost, bez_oceny: bezOceny }
}

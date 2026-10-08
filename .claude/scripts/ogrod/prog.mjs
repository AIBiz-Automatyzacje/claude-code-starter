// Porownanie z poprzednim pomiarem (rekord `ogrod` runu autopilota w telemetrii) i decyzja o agencie oceny.
// Progi ustalone przy wdrozeniu P15 na historii oferty-online (16 zadan: ocena w 4 — 2 × przyrost, 1 × wyciszenie, 1 × okresowa):
// ocena przy nowym wyciszeniu, przy sumie przyrostu pozostalych kategorii >= PROG_PRZYROSTU albo co CO_ILE_POMIAROW pomiarow.
// Tozsamosc projektu = nazwa katalogu (jak `projekt` w telemetrii, zbieranie.mjs): dwa projekty o tej samej nazwie dziela
// historie, a sesja w worktree o innej nazwie zaczyna od pierwszego pomiaru.

import { existsSync } from 'node:fs'

import { czytajJsonl } from '../telemetria/zrodla.mjs'
import { KATEGORIE, liczbyZRekordu } from './kategorie.mjs'

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
 * Ostatni pomiar ogrodu tego projektu z runow autopilota innych zadan (po polu `start`). Wpisy w kolejnosci zapisu: dla klucza
 * runu liczy sie ostatnia wersja Z POMIAREM — pomiar po koncu runu sie nie zmienia, a kolektor ze starszego szablonu dopisuje
 * wersje bez pola `ogrod`. Rekordy biezacego zadania pomijane: swiezy run po nieudanej archiwizacji nie porownuje sie z soba.
 * @param {Iterable<Record<string, unknown>>} wpisy
 * @param {{ projekt: string, zadanie?: string | null }} filtr projekt = nazwa katalogu jak w telemetrii
 * @returns {Poprzedni | null}
 */
export function poprzedniPomiar(wpisy, filtr) {
  /** @type {Map<string, Poprzedni>} */
  const poKluczu = new Map()
  for (const r of wpisy) {
    if (r.typ !== 'run' || r.workflow !== 'dev-autopilot' || r.projekt !== filtr.projekt) continue
    if (filtr.zadanie && r.zadanie === filtr.zadanie) continue
    const ogrod = obiekt(r.ogrod)
    const liczby = liczbyZRekordu(ogrod.liczby)
    if (!liczby) continue
    const klucz = typeof r.klucz === 'string' ? r.klucz : String(r.run)
    poKluczu.set(klucz, {
      run: typeof r.run === 'string' ? r.run : null,
      start: typeof r.start === 'string' ? r.start : null,
      liczby,
      bez_oceny: Number.isInteger(ogrod.bez_oceny) ? /** @type {number} */ (ogrod.bez_oceny) : 0,
    })
  }
  /** @type {Poprzedni | null} */
  let najnowszy = null
  for (const p of poKluczu.values()) if (!najnowszy || (p.start ?? '') > (najnowszy.start ?? '')) najnowszy = p
  return najnowszy
}

/**
 * @param {string} plikTelemetrii
 * @param {{ projekt: string, zadanie?: string | null }} filtr
 * @returns {Poprzedni | null}
 */
export function poprzedniZPliku(plikTelemetrii, filtr) {
  return existsSync(plikTelemetrii) ? poprzedniPomiar(czytajJsonl(plikTelemetrii).wpisy, filtr) : null
}

/**
 * Funkcja progu. `przyrost` = zmiana netto wzgledem poprzedniego rekordu (bez niego: wystapienia w liniach dodanych przez
 * zadanie). Dla wyciszen decyzja bierze wieksza z liczb: netto albo linie dodane — zadanie, ktore usuwa wyciszenie w jednym
 * pliku i dodaje w drugim, ma bilans 0, a nowe wyciszenie i tak jest. Pozostale kategorie tylko netto: diff -U0 liczy linie
 * ZMIENIONE jak dodane, wiec edycja linii z zastanym `x!` dawalaby przyrost bez nowego wzorca.
 * @param {{ liczby: Record<Kategoria, number>, noweLiczby: Record<Kategoria, number>, poprzedni: Poprzedni | null }} we
 * @returns {Decyzja}
 */
export function decyzjaOceny(we) {
  const poprzedni = we.poprzedni
  const zrodlo = poprzedni ? 'telemetria' : 'diff'
  const przyrost = /** @type {Record<Kategoria, number>} */ (Object.fromEntries(KATEGORIE.map((k) =>
    [k, poprzedni ? we.liczby[k] - poprzedni.liczby[k] : we.noweLiczby[k]])))
  const wyciszenia = Math.max(przyrost.wyciszenia, we.noweLiczby.wyciszenia, 0)
  const wyciszeniaZDiffu = poprzedni !== null && wyciszenia > przyrost.wyciszenia
  const bezOceny = (poprzedni?.bez_oceny ?? 0) + 1
  const suma = KATEGORIE.filter((k) => k !== 'wyciszenia').reduce((s, k) => s + Math.max(0, przyrost[k]), 0)
  const opisZrodla = zrodlo === 'telemetria' ? 'wzgledem poprzedniego zadania' : 'w liniach dodanych przez zadanie (pierwszy pomiar)'
  /** @type {string[]} */
  const powody = []
  if (wyciszenia >= PROG_WYCISZEN) {
    powody.push(`nowe wyciszenia lint/TS: +${wyciszenia} ${wyciszeniaZDiffu ? 'w liniach dodanych przez zadanie (bilans netto wzgledem poprzedniego zadania: ' + przyrost.wyciszenia + ')' : opisZrodla}`)
  }
  if (suma >= PROG_PRZYROSTU) powody.push(`przyrost pozostalych kategorii: +${suma} ${opisZrodla} (prog ${PROG_PRZYROSTU})`)
  if (bezOceny >= CO_ILE_POMIAROW) powody.push(`przeglad okresowy: ${bezOceny} pomiarow bez oceny (co ${CO_ILE_POMIAROW})`)
  const powod = powody.length
    ? powody.join('; ')
    : `bez oceny: przyrost ponizej progu ${opisZrodla}, ${bezOceny}/${CO_ILE_POMIAROW} pomiarow do przegladu okresowego`
  return { ocena: powody.length > 0, powod, zrodlo, przyrost, bez_oceny: bezOceny }
}

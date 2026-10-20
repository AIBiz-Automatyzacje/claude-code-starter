// Kolejka zgloszen narzedzia makiet (P24 IU-5). „Zgłoś błąd” zapisuje najpierw linie checklisty (stan punktu), potem wpis
// w `kolejka.jsonl` katalogu stanu — tylko do dostarczenia zgloszenia sesji smoke'u. Sesja trzyma `makieta.mjs czekaj` w Monitorze:
// przy starcie wypisuje zgloszenia jeszcze niedostarczone, potem kazde nowe jako jedna linia JSON, na koncu `limit` (Monitor zyje
// najwyzej 30 min) albo `serwer-zatrzymany`. Dostarczone id dopisujemy do `dostarczone.jsonl` (tylko dopisywanie — serwer
// i `czekaj` nie przepisuja wspolnego pliku). Zgloszenia otwarte (droga awaryjna) liczymy z checklisty, nie z kolejki.

import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as czekajMs } from 'node:timers/promises'

export const LIMIT_CZEKANIA_MIN = 25
const PLIK_KOLEJKI = 'kolejka.jsonl'
const PLIK_DOSTARCZONYCH = 'dostarczone.jsonl'
const ODSTEP_MS = 500

/**
 * @typedef {import('./punkty.mjs').Punkt} Punkt
 * @typedef {{ punkt: string, ekran: string, trasa: string | null, viewport: import('./punkty.mjs').Wymiary | null, urzadzenie: string,
 *   szerokosc: number, opis: string, spec: string | null, makieta: string | null }} Zgloszenie
 * @typedef {Zgloszenie & { id: string, czas: string }} WpisKolejki
 * @typedef {({ zdarzenie: 'zgloszenie' } & WpisKolejki) | { zdarzenie: 'limit' } | { zdarzenie: 'serwer-zatrzymany' }} Zdarzenie
 */

/** @param {string} plik @returns {unknown[]} obiekty z linii JSON; linia uszkodzona (przerwany zapis) pominieta */
function linieJson(plik) {
  if (!existsSync(plik)) return []
  return readFileSync(plik, 'utf8').split('\n').filter(Boolean).flatMap((l) => {
    try {
      return [JSON.parse(l)]
    } catch {
      // Niedokonczona linia przy rownoczesnym dopisywaniu — nastepny odczyt zobaczy ja cala.
      return []
    }
  })
}

/**
 * @param {string} katalogStanu
 * @param {Zgloszenie} zgloszenie
 * @returns {WpisKolejki}
 */
export function dopiszZgloszenie(katalogStanu, zgloszenie) {
  mkdirSync(katalogStanu, { recursive: true })
  const wpis = { ...zgloszenie, id: randomUUID(), czas: new Date().toISOString() }
  appendFileSync(join(katalogStanu, PLIK_KOLEJKI), `${JSON.stringify(wpis)}\n`)
  return wpis
}

/** @param {unknown} x @returns {x is { id: string }} */
const zId = (x) => typeof x === 'object' && x !== null && 'id' in x && typeof x.id === 'string'

/** @param {unknown} x @returns {x is WpisKolejki} wpis zapisany przez dopiszZgloszenie (pola tekstowe zgloszenia) */
const czyWpis = (x) => zId(x) && ['punkt', 'ekran', 'opis', 'urzadzenie', 'czas'].every((k) => typeof (/** @type {Record<string, unknown>} */ (x))[k] === 'string')

/** @param {string} katalogStanu @returns {WpisKolejki[]} wpisy kolejki bez dostarczonych, w kolejnosci zgloszenia */
export function niedostarczone(katalogStanu) {
  const dostarczone = new Set(linieJson(join(katalogStanu, PLIK_DOSTARCZONYCH)).filter(zId).map((x) => x.id))
  return linieJson(join(katalogStanu, PLIK_KOLEJKI)).filter(czyWpis).filter((w) => !dostarczone.has(w.id))
}

/** @param {string} katalogStanu @param {string} id */
function oznaczDostarczone(katalogStanu, id) {
  appendFileSync(join(katalogStanu, PLIK_DOSTARCZONYCH), `${JSON.stringify({ id, czas: new Date().toISOString() })}\n`)
}

/**
 * Zdarzenia dla Monitora: niedostarczone zgloszenia (kazde raz — oznaczone po oddaniu), potem nowe, na koncu limit albo
 * serwer-zatrzymany.
 * @param {{ katalogStanu: string, limitMs: number, odstepMs?: number, czyZyje?: () => Promise<boolean> }} o
 * @returns {AsyncGenerator<Zdarzenie>}
 */
export async function* czekaj({ katalogStanu, limitMs, odstepMs = ODSTEP_MS, czyZyje = async () => true }) {
  const termin = Date.now() + limitMs
  for (;;) {
    for (const wpis of niedostarczone(katalogStanu)) {
      yield { zdarzenie: 'zgloszenie', ...wpis }
      oznaczDostarczone(katalogStanu, wpis.id)
    }
    if (Date.now() >= termin) {
      yield { zdarzenie: 'limit' }
      return
    }
    if (!(await czyZyje())) {
      yield { zdarzenie: 'serwer-zatrzymany' }
      return
    }
    await czekajMs(Math.min(odstepMs, Math.max(0, termin - Date.now())))
  }
}

/** @param {Punkt[]} punkty @returns {Punkt[]} punkty ze statusem „błąd zgłoszony” — zgloszenia, ktorych sesja jeszcze nie poprawila */
export function otwarteZgloszenia(punkty) {
  return punkty.filter((p) => p.status === 'blad')
}

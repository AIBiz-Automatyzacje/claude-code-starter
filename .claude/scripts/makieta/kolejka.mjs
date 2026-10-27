// Kolejka zgloszen narzedzia makiet (P24 IU-5). „Zgłoś błąd” zapisuje najpierw linie checklisty (stan punktu), potem wpis
// w `kolejka.jsonl` katalogu stanu — tylko do dostarczenia zgloszenia sesji smoke'u. Sesja trzyma `makieta.mjs czekaj` w Monitorze:
// przy starcie wypisuje zgloszenia jeszcze niedostarczone, potem kazde nowe jako jedna linia JSON, na koncu `limit` (Monitor zyje
// najwyzej 30 min) albo `serwer-zatrzymany`. Dostarczone id dopisujemy do `dostarczone.jsonl` (tylko dopisywanie — serwer
// i `czekaj` nie przepisuja wspolnego pliku). Zgloszenia otwarte (droga awaryjna) liczymy z checklisty, nie z kolejki.
// P28 (pilot etapu 5): w trybie „na koniec” (domyslnym) „Zgłoś błąd” zapisuje tylko linie, a „Zakończ przegląd” dopisuje jeden
// wpis `przeglad` z wszystkimi otwartymi zgloszeniami i podsumowaniem — sesja nie przerywa operatorowi przegladu w polowie.

import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as czekajMs } from 'node:timers/promises'

import { ZNACZNIK_ZRZUTU } from './punkty.mjs'

export const LIMIT_CZEKANIA_MIN = 25
const PLIK_KOLEJKI = 'kolejka.jsonl'
const PLIK_DOSTARCZONYCH = 'dostarczone.jsonl'
const ODSTEP_MS = 500

/**
 * @typedef {import('./punkty.mjs').Punkt} Punkt
 * @typedef {{ punkt: string, ekran: string, trasa: string | null, viewport: import('./punkty.mjs').Wymiary | null, urzadzenie: string,
 *   szerokosc: number, opis: string, spec: string | null, makieta: string | null, zrzut: string | null }} Zgloszenie
 * @typedef {Zgloszenie & { id: string, czas: string }} WpisKolejki
 * @typedef {{ punkt: string, linia: number, zgloszenie: string | undefined, zrzut: string | null, tresc: string, trasa: string | null,
 *   ekrany: { ekran: string, spec: string | null, makieta: string | null, wymiary: import('./punkty.mjs').Wymiary | null }[] }} OtwarteZgloszenie
 * @typedef {{ punkty: number } & Record<Punkt['status'], number>} Podsumowanie
 * @typedef {{ smoke: string, zgloszenia: OtwarteZgloszenie[], podsumowanie: Podsumowanie }} Przeglad
 * @typedef {Przeglad & { typ: 'przeglad', id: string, czas: string }} WpisPrzegladu
 * @typedef {({ zdarzenie: 'zgloszenie' } & WpisKolejki) | ({ zdarzenie: 'przeglad-zakonczony' } & Przeglad & { id: string, czas: string })
 *   | { zdarzenie: 'limit' } | { zdarzenie: 'serwer-zatrzymany' }} Zdarzenie
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

/**
 * @param {string} katalogStanu
 * @param {Przeglad} przeglad
 * @returns {WpisPrzegladu}
 */
export function dopiszPrzeglad(katalogStanu, przeglad) {
  mkdirSync(katalogStanu, { recursive: true })
  /** @type {WpisPrzegladu} */
  const wpis = { typ: 'przeglad', ...przeglad, id: randomUUID(), czas: new Date().toISOString() }
  appendFileSync(join(katalogStanu, PLIK_KOLEJKI), `${JSON.stringify(wpis)}\n`)
  return wpis
}

/** @param {unknown} x @returns {x is { id: string }} */
const zId = (x) => typeof x === 'object' && x !== null && 'id' in x && typeof x.id === 'string'

/** @param {unknown} x @returns {x is WpisKolejki} wpis zapisany przez dopiszZgloszenie (pola tekstowe zgloszenia) */
const czyWpis = (x) => zId(x) && ['punkt', 'ekran', 'opis', 'urzadzenie', 'czas'].every((k) => typeof (/** @type {Record<string, unknown>} */ (x))[k] === 'string')

/** @param {unknown} x @returns {x is WpisPrzegladu} wpis zapisany przez dopiszPrzeglad */
const czyPrzeglad = (x) => zId(x) && 'typ' in x && x.typ === 'przeglad' && 'zgloszenia' in x && Array.isArray(x.zgloszenia)

/** @param {string} katalogStanu @returns {(WpisKolejki | WpisPrzegladu)[]} wpisy kolejki bez dostarczonych, w kolejnosci zapisu */
export function niedostarczone(katalogStanu) {
  const dostarczone = new Set(linieJson(join(katalogStanu, PLIK_DOSTARCZONYCH)).filter(zId).map((x) => x.id))
  return linieJson(join(katalogStanu, PLIK_KOLEJKI)).filter((x) => czyWpis(x) || czyPrzeglad(x)).filter((w) => !dostarczone.has(w.id))
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
      if ('typ' in wpis) {
        const { typ, ...przeglad } = wpis
        yield { zdarzenie: 'przeglad-zakonczony', ...przeglad }
      } else yield { zdarzenie: 'zgloszenie', ...wpis }
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

/** @param {string | undefined} adnotacja @returns {string | null} sciezka zrzutu operatora z konca adnotacji bledu (P27 S3) */
function zrzutAdnotacji(adnotacja) {
  const i = adnotacja?.lastIndexOf(ZNACZNIK_ZRZUTU) ?? -1
  return adnotacja && i !== -1 ? adnotacja.slice(i + ZNACZNIK_ZRZUTU.length).trim() : null
}

/**
 * Otwarte zgloszenia z ekranami (SPEC, PNG, wymiary) — wynik `makieta.mjs zgloszenia` i lista w zdarzeniu konca przegladu.
 * @param {Punkt[]} punkty
 * @param {import('./zrodla.mjs').Zrodla} zrodla
 * @returns {OtwarteZgloszenie[]}
 */
export function opisOtwartych(punkty, zrodla) {
  return otwarteZgloszenia(punkty).map((p) => ({
    punkt: p.id, linia: p.linia, zgloszenie: p.adnotacje[0], zrzut: zrzutAdnotacji(p.adnotacje[0]), tresc: p.tresc, trasa: p.trasa,
    ekrany: zrodla.ekrany.filter((e) => e.punkt === p.id).map(({ ekran, spec, makieta, wymiary }) => ({ ekran, spec, makieta, wymiary })),
  }))
}

/** @param {Punkt[]} punkty @returns {Podsumowanie} liczba punktow wedlug statusu */
export function podsumowanie(punkty) {
  /** @type {Podsumowanie} */
  const p = { punkty: punkty.length, otwarty: 0, zgodny: 0, odstepstwo: 0, blad: 0, poprawione: 0 }
  for (const x of punkty) p[x.status] += 1
  return p
}

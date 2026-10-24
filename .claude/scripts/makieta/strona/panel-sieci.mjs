// Panel „Sieć” strony narzedzia makiet (P28 (5), pilot etapu 5): operator wywoluje stany ladowania i bledow bez DevTools.
// Ustawienia trafiaja do localStorage `makieta.siec` (wspolny origin z ramkami) — czyta je skrypt siec.mjs wstrzykniety przez
// proxy do stron aplikacji, przy kazdym zadaniu. Nowa strona narzedzia zaczyna bez ograniczen (zapis z poprzedniego przegladu
// nie spowalnia aplikacji po cichu).

import { liczebnik } from './teksty.mjs'

const KLUCZ = 'makieta.siec'
/** Opoznienie zadania jak latencja profili DevTools (bez ograniczenia przepustowosci). */
export const PROFILE_SIECI = Object.freeze([
  { nazwa: 'Bez ograniczeń', opoznienieMs: 0 },
  { nazwa: 'Fast 3G', opoznienieMs: 560 },
  { nazwa: 'Slow 3G', opoznienieMs: 2000 },
])

/** @typedef {{ opoznienieMs: number, blokady: string[] }} UstawieniaSieci */

/** @param {string} opoznienie wartosc pola wyboru @param {string} blokady wzorce po jednym w linii @returns {UstawieniaSieci} */
export function ustawieniaZFormularza(opoznienie, blokady) {
  const ms = Number(opoznienie)
  return { opoznienieMs: Number.isFinite(ms) && ms > 0 ? ms : 0, blokady: blokady.split('\n').map((w) => w.trim()).filter(Boolean) }
}

/** @param {UstawieniaSieci} u @returns {string} nagłowek panelu — aktywne ograniczenia widac bez rozwijania */
export function opisSieci(u) {
  const czesci = []
  if (u.opoznienieMs) czesci.push(PROFILE_SIECI.find((p) => p.opoznienieMs === u.opoznienieMs)?.nazwa ?? `+${u.opoznienieMs} ms`)
  if (u.blokady.length) czesci.push(liczebnik(u.blokady.length, ['blokada', 'blokady', 'blokad']))
  return czesci.length ? `Sieć: ${czesci.join(' · ')}` : 'Sieć'
}

/** @param {UstawieniaSieci} u */
function zapisz(u) {
  try {
    localStorage.setItem(KLUCZ, JSON.stringify(u))
  } catch {
    // Bez localStorage panel nie dziala — operator zostaje przy DevTools; strona pokazuje to w stanie panelu.
  }
}

/** @param {HTMLElement} ramki @returns {string} w ilu ramkach dziala skrypt sieci (CSP aplikacji moze go zablokowac) */
function stanRamek(ramki) {
  const lista = [...ramki.querySelectorAll('iframe')]
  const aktywne = lista.filter((f) => {
    try {
      return Boolean(f.contentWindow && /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (f.contentWindow)).__makietaSiec)
    } catch {
      // Ramka na obcym originie (np. przekierowanie do dostawcy logowania) — skrypt tam nie dziala.
      return false
    }
  })
  return `Działa w ${aktywne.length}/${lista.length} ramkach.` + (aktywne.length < lista.length ? ' Ramka bez skryptu: przeładuj ramki; gdy dalej brak — CSP aplikacji blokuje skrypt, zostają DevTools.' : '')
}

/**
 * @param {{ panel: HTMLDetailsElement, naglowek: HTMLElement, opoznienie: HTMLSelectElement, blokady: HTMLTextAreaElement,
 *   formularz: HTMLFormElement, stan: HTMLElement, ramki: HTMLElement }} e
 */
export function podepnijPanelSieci(e) {
  e.opoznienie.replaceChildren(...PROFILE_SIECI.map((p) => new Option(p.opoznienieMs ? `${p.nazwa} (+${p.opoznienieMs} ms)` : p.nazwa, String(p.opoznienieMs))))
  /** @param {UstawieniaSieci} u */
  const ustaw = (u) => {
    zapisz(u)
    e.naglowek.textContent = opisSieci(u)
    e.panel.classList.toggle('siec--aktywna', u.opoznienieMs > 0 || u.blokady.length > 0)
    e.stan.textContent = stanRamek(e.ramki)
  }
  ustaw({ opoznienieMs: 0, blokady: [] })
  e.formularz.addEventListener('submit', (z) => {
    z.preventDefault()
    ustaw(ustawieniaZFormularza(e.opoznienie.value, e.blokady.value))
  })
  e.formularz.addEventListener('reset', () => ustaw({ opoznienieMs: 0, blokady: [] }))
  // Stan ramek po kazdym zaladowaniu ramki (load nie bąbelkuje — nasluch w fazie przechwytywania).
  e.ramki.addEventListener('load', () => { e.stan.textContent = stanRamek(e.ramki) }, true)
}

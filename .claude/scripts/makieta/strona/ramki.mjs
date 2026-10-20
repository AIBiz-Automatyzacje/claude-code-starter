// Ramki urzadzen strony narzedzia makiet (P24 IU-7): aplikacja (ten sam origin co strona, przez proxy) w ramkach o wymiarach
// presetow, wspolna trasa dla wszystkich ramek, skalowanie `transform: scale` z oknem po skali (media queries ramki widza
// pelna szerokosc urzadzenia), przelacznik 1:1 i wybor urzadzen pamietany miedzy ekranami (localStorage z try/catch).
// Strona nie czyta zawartosci ramek: jedyna interakcja to `src` i przeladowanie.

const KLUCZ_WYBORU = 'makieta.urzadzenia'
const ODSTEP_RAMEK_PX = 16

/** @typedef {import('../urzadzenia.mjs').Urzadzenie} Urzadzenie */

/** @param {unknown} x @returns {x is Urzadzenie} */
const czyUrzadzenie = (x) => typeof x === 'object' && x !== null && 'id' in x && 'szerokosc' in x && 'wysokosc' in x && 'nazwa' in x
  && typeof x.id === 'string' && typeof x.nazwa === 'string' && Number.isInteger(x.szerokosc) && Number.isInteger(x.wysokosc)

/** @returns {Urzadzenie[] | null} reczny wybor operatora albo null (brak, prywatne okno, uszkodzony zapis) */
export function zapisanyWybor() {
  try {
    const w = JSON.parse(localStorage.getItem(KLUCZ_WYBORU) ?? 'null')
    return Array.isArray(w) && w.length && w.every(czyUrzadzenie) ? w : null
  } catch {
    // localStorage niedostepny albo zapis uszkodzony — wybor domyslny.
    return null
  }
}

/** @param {Urzadzenie[] | null} wybor null = powrot do wyboru domyslnego */
export function zapiszWybor(wybor) {
  try {
    if (wybor) localStorage.setItem(KLUCZ_WYBORU, JSON.stringify(wybor))
    else localStorage.removeItem(KLUCZ_WYBORU)
  } catch {
    // Bez localStorage wybor dziala do przeladowania strony — tylko wygoda operatora.
  }
}

/**
 * Wspolna skala ramek: wszystkie w jednym rzedzie w szerokosci kolumny, najwyzej 1.
 * @param {Urzadzenie[]} urzadzenia
 * @param {number} szerokoscKolumny
 * @returns {number}
 */
export function skalaRamek(urzadzenia, szerokoscKolumny) {
  const razem = urzadzenia.reduce((s, u) => s + u.szerokosc, 0) + ODSTEP_RAMEK_PX * Math.max(0, urzadzenia.length - 1)
  return razem > 0 ? Math.min(1, szerokoscKolumny / razem) : 1
}

/**
 * Ramki dla urzadzen na trasie; poprzednie ramki znikaja.
 * @param {HTMLElement} kontener
 * @param {Urzadzenie[]} urzadzenia
 * @param {string} trasa
 * @param {{ jedenDoJednego: boolean }} opcje
 */
export function ustawRamki(kontener, urzadzenia, trasa, { jedenDoJednego }) {
  const skala = jedenDoJednego ? 1 : skalaRamek(urzadzenia, kontener.clientWidth)
  kontener.replaceChildren(...urzadzenia.map((u) => {
    const ramka = document.createElement('figure')
    ramka.className = 'ramka'
    ramka.style.margin = '0'
    const podpis = document.createElement('figcaption')
    podpis.textContent = `${u.nazwa} · ${u.szerokosc}×${u.wysokosc}${skala < 1 ? ` · ${Math.round(skala * 100)}%` : ''}`
    const okno = document.createElement('div')
    okno.className = 'ramka__okno'
    okno.style.width = `${Math.round(u.szerokosc * skala)}px`
    okno.style.height = `${Math.round(u.wysokosc * skala)}px`
    const iframe = document.createElement('iframe')
    iframe.title = `Aplikacja — ${u.nazwa}`
    iframe.width = String(u.szerokosc)
    iframe.height = String(u.wysokosc)
    iframe.style.transform = `scale(${skala})`
    iframe.dataset.urzadzenie = u.id
    iframe.src = trasa
    okno.append(iframe)
    ramka.append(podpis, okno)
    return ramka
  }))
}

/** @param {HTMLElement} kontener @param {string} trasa wszystkie ramki od nowa na trasie */
export function przeladujRamki(kontener, trasa) {
  for (const iframe of kontener.querySelectorAll('iframe')) {
    // Ten sam src nie przeladowuje ramki, ktora zmienila trase sama (nawigacja w aplikacji) — ustawiamy go od nowa przez about:blank.
    iframe.src = 'about:blank'
    iframe.src = trasa
  }
}

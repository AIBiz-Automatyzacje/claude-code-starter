// Ramki urzadzen strony narzedzia makiet (P24 IU-7): aplikacja (ten sam origin co strona, przez proxy) w ramkach o wymiarach
// presetow, wspolna trasa dla wszystkich ramek, skalowanie `transform: scale` z oknem po skali (media queries ramki widza
// pelna szerokosc urzadzenia), przelacznik 1:1 i wybor urzadzen pamietany miedzy ekranami (localStorage z try/catch).
// Strona nie czyta zawartosci ramek: jedyna interakcja to `src` i przeladowanie.

const KLUCZ_WYBORU = 'makieta.urzadzenia'
const ODSTEP_RAMEK_PX = 16
const OBRAMOWANIE_PX = 1
const MARGINES_PASKA_PX = 20

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

/** @param {Urzadzenie[] | null} wybor null = powrot do wyboru domyslnego; ramka „wymiar makiety” nalezy do ekranu, nie zostaje */
export function zapiszWybor(wybor) {
  try {
    const trwale = wybor?.filter((u) => !u.id.startsWith('makieta-')) ?? []
    if (trwale.length) localStorage.setItem(KLUCZ_WYBORU, JSON.stringify(trwale))
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
  // Obramowanie okna i margines na pionowy pasek przewijania (pojawia sie po wstawieniu ramek) — inaczej ostatnia ramka spada nizej.
  const razem = urzadzenia.reduce((s, u) => s + u.szerokosc + 2 * OBRAMOWANIE_PX, 0) + ODSTEP_RAMEK_PX * Math.max(0, urzadzenia.length - 1)
  return razem > 0 ? Math.min(1, (szerokoscKolumny - MARGINES_PASKA_PX) / razem) : 1
}

/** @param {HTMLElement} okno @param {HTMLIFrameElement} iframe @param {HTMLElement} podpis @param {Urzadzenie} u @param {number} skala */
function wymiaruj(okno, iframe, podpis, u, skala) {
  podpis.textContent = `${u.nazwa} · ${u.szerokosc}×${u.wysokosc}${skala < 1 ? ` · ${Math.round(skala * 100)}%` : ''}`
  okno.style.width = `${Math.floor(u.szerokosc * skala)}px`
  okno.style.height = `${Math.floor(u.wysokosc * skala)}px`
  iframe.style.transform = `scale(${skala})`
}

/**
 * Nowa skala istniejacych ramek (zmiana okna, 1:1) bez tworzenia ich od nowa — aplikacja w ramkach zachowuje stan.
 * @param {HTMLElement} kontener
 * @param {Urzadzenie[]} urzadzenia te same, dla ktorych powstaly ramki
 * @param {{ jedenDoJednego: boolean }} opcje
 */
export function skalujRamki(kontener, urzadzenia, { jedenDoJednego }) {
  const skala = jedenDoJednego ? 1 : skalaRamek(urzadzenia, kontener.clientWidth)
  kontener.querySelectorAll('figure').forEach((ramka, i) => {
    const okno = ramka.querySelector('.ramka__okno')
    const iframe = ramka.querySelector('iframe')
    const podpis = ramka.querySelector('figcaption')
    if (okno instanceof HTMLElement && iframe && podpis && urzadzenia[i]) wymiaruj(okno, iframe, podpis, urzadzenia[i], skala)
  })
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
    const okno = document.createElement('div')
    okno.className = 'ramka__okno'
    const iframe = document.createElement('iframe')
    iframe.title = `Aplikacja — ${u.nazwa}`
    iframe.width = String(u.szerokosc)
    iframe.height = String(u.wysokosc)
    iframe.dataset.urzadzenie = u.id
    wymiaruj(okno, iframe, podpis, u, skala)
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

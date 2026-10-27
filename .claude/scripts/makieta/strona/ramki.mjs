// Ramki urzadzen strony narzedzia makiet (P24 IU-7): aplikacja (ten sam origin co strona, przez proxy) w ramkach o wymiarach
// presetow, wspolna trasa dla wszystkich ramek, skalowanie `transform: scale` z oknem po skali (media queries ramki widza
// pelna szerokosc urzadzenia), wybor urzadzen pamietany miedzy ekranami (localStorage z try/catch). Skala (P28): „przewijaj”
// (domyslna) — najszersza ramka na szerokosc kolumny, rzad przewijany w poziomie; „wszystkie” — caly rzad w kolumnie; „1:1”.
// Strona nie czyta zawartosci ramek: jedyna interakcja to `src` i przeladowanie. Adres ramki (P27 S3) zglasza skrypt
// wstrzykiwany przez proxy (`siec.mjs`, `postMessage`); strona trzyma go w `data-adres` ramki.

const KLUCZ_WYBORU = 'makieta.urzadzenia'
const ODSTEP_RAMEK_PX = 16
const OBRAMOWANIE_PX = 1
const MARGINES_PASKA_PX = 20
const ORIGIN_WZGLEDNY = 'http://makieta.invalid'
// Przekierowanie po przeniesieniu ramki przychodzi zaraz po jej zaladowaniu (start dokumentu albo replace routera).
const OKNO_ECHA_MS = 3000
const RODZAJE = new Set(['start', 'push', 'replace', 'pop'])

/**
 * @typedef {import('../urzadzenia.mjs').Urzadzenie} Urzadzenie
 * @typedef {'przewijaj' | 'wszystkie' | '1:1'} TrybSkali
 */

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
 * Wspolna skala ramek, najwyzej 1: „przewijaj” — najszersza ramka w szerokosci kolumny, „wszystkie” — caly rzad, „1:1” — 1.
 * @param {Urzadzenie[]} urzadzenia
 * @param {number} szerokoscKolumny
 * @param {TrybSkali} tryb
 * @returns {number}
 */
export function skalaRamek(urzadzenia, szerokoscKolumny, tryb) {
  if (tryb === '1:1' || !urzadzenia.length) return 1
  const szerokosci = urzadzenia.map((u) => u.szerokosc + 2 * OBRAMOWANIE_PX)
  // Margines na pionowy pasek przewijania (pojawia sie po wstawieniu ramek) — inaczej ostatnia ramka spada nizej.
  const potrzebne = tryb === 'wszystkie' ? szerokosci.reduce((s, w) => s + w, 0) + ODSTEP_RAMEK_PX * (urzadzenia.length - 1) : Math.max(...szerokosci)
  return Math.min(1, (szerokoscKolumny - MARGINES_PASKA_PX) / potrzebne)
}

/** @param {HTMLElement} okno @param {HTMLIFrameElement} iframe @param {HTMLElement} podpis @param {Urzadzenie} u @param {number} skala */
function wymiaruj(okno, iframe, podpis, u, skala) {
  podpis.textContent = `${u.nazwa} · ${u.szerokosc}×${u.wysokosc}${skala < 1 ? ` · ${Math.round(skala * 100)}%` : ''}`
  okno.style.width = `${Math.floor(u.szerokosc * skala)}px`
  okno.style.height = `${Math.floor(u.wysokosc * skala)}px`
  iframe.style.transform = `scale(${skala})`
}

/**
 * Nowa skala istniejacych ramek (zmiana okna, tryb skali) bez tworzenia ich od nowa — aplikacja w ramkach zachowuje stan.
 * @param {HTMLElement} kontener
 * @param {Urzadzenie[]} urzadzenia te same, dla ktorych powstaly ramki
 * @param {TrybSkali} tryb
 */
export function skalujRamki(kontener, urzadzenia, tryb) {
  const skala = skalaRamek(urzadzenia, kontener.clientWidth, tryb)
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
 * @param {TrybSkali} tryb
 */
export function ustawRamki(kontener, urzadzenia, trasa, tryb) {
  const skala = skalaRamek(urzadzenia, kontener.clientWidth, tryb)
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
    iframe.dataset.adres = trasa
    iframe.dataset.przeniesiona = String(Date.now())
    wymiaruj(okno, iframe, podpis, u, skala)
    iframe.src = trasa
    okno.append(iframe)
    ramka.append(podpis, okno)
    return ramka
  }))
}

/**
 * @param {string} trasa wpis operatora albo adres zgloszony przez ramke
 * @returns {string | null} trasa tego originu poza strona narzedzia; `//host` i `/\\host` przegladarka czyta jako adres obcy
 *   (ramka ucieklaby z proxy)
 */
export function bezpiecznaTrasa(trasa) {
  if (!trasa.startsWith('/') || trasa.includes('\\') || trasa.startsWith('/__makieta/')) return null
  try {
    // Parser URL zdejmuje tabulatory i nowe linie — `/\t/host` to tez adres obcy.
    return new URL(trasa, ORIGIN_WZGLEDNY).origin === ORIGIN_WZGLEDNY ? trasa : null
  } catch {
    // Trasa, ktorej przegladarka nie zlozy w adres — jak obca.
    return null
  }
}

/**
 * Komunikat skryptu ramki o jej adresie (P27 S3 poz. 25). „Ramki razem”: pozostale ramki ida na ten adres. Bez petli: ramka
 * przeniesiona zglasza po zaladowaniu adres, ktory juz ma w `data-adres`, a jej przekierowanie (start albo replace w oknie
 * OKNO_ECHA_MS od przeniesienia — np. telefon `/x` → `/m/x`) zmienia tylko jej adres; push i pop rozsylane zawsze.
 * @param {HTMLElement} kontener
 * @param {{ origin: string, source: unknown, data: unknown }} zdarzenie zdarzenie `message` okna strony
 * @param {{ origin: string, razem: boolean, teraz?: number }} opcje origin strony narzedzia (i proxy)
 * @returns {string | null} nowy adres ramki-nadawcy (do paska adresu) albo null, gdy komunikat nic nie zmienia
 */
export function adresZRamki(kontener, zdarzenie, { origin, razem, teraz = Date.now() }) {
  const { data } = zdarzenie
  if (zdarzenie.origin !== origin || typeof data !== 'object' || data === null || !('makieta' in data) || data.makieta !== 'adres') return null
  const rodzaj = 'rodzaj' in data && typeof data.rodzaj === 'string' && RODZAJE.has(data.rodzaj) ? data.rodzaj : null
  const trasa = 'adres' in data && typeof data.adres === 'string' ? bezpiecznaTrasa(data.adres) : null
  const ramki = [...kontener.querySelectorAll('iframe')]
  const nadawca = ramki.find((r) => r.contentWindow === zdarzenie.source)
  if (!rodzaj || !trasa || !nadawca || nadawca.dataset.adres === trasa) return null
  const echo = (rodzaj === 'start' || rodzaj === 'replace') && teraz - Number(nadawca.dataset.przeniesiona ?? -Infinity) < OKNO_ECHA_MS
  nadawca.dataset.adres = trasa
  if (razem && !echo) przeniesRamki(kontener, trasa, teraz)
  return trasa
}

/**
 * @param {HTMLElement} kontener
 * @param {string} trasa ramki z innym adresem ida na trase (ramki z nia zostaja bez przeladowania)
 * @param {number} [teraz] chwila przeniesienia — od niej liczy sie okno echa przekierowania
 */
export function przeniesRamki(kontener, trasa, teraz = Date.now()) {
  for (const iframe of kontener.querySelectorAll('iframe')) {
    if (iframe.dataset.adres === trasa) continue
    iframe.dataset.adres = trasa
    iframe.dataset.przeniesiona = String(teraz)
    iframe.src = trasa
  }
}

/** @param {HTMLElement} kontener @param {string} trasa ramki od nowa na swoim adresie (P27 S3); ramka bez zgloszonego adresu — na trasie */
export function przeladujRamki(kontener, trasa) {
  for (const iframe of kontener.querySelectorAll('iframe')) {
    // Ten sam src nie przeladowuje ramki, ktora zmienila trase sama (nawigacja w aplikacji) — ustawiamy go od nowa przez about:blank.
    iframe.src = 'about:blank'
    iframe.dataset.przeniesiona = String(Date.now())
    iframe.src = iframe.dataset.adres || trasa
  }
}

/**
 * Przeciaganie rzedu ramek w poziomie za podpisy i odstepy (ramki iframe same lapia wskaznik) — obok paska przewijania
 * i Shift + kolko.
 * @param {HTMLElement} kontener
 */
export function przeciaganieRzedu(kontener) {
  /** @type {{ x: number, przewiniecie: number } | null} */
  let start = null
  kontener.addEventListener('pointerdown', (z) => {
    // Klik w poziomy pasek przewijania (pod clientHeight) przewija sam — przechwycenie przewijaloby podwojnie.
    const naPasku = z.clientY >= kontener.getBoundingClientRect().top + kontener.clientHeight
    if (z.button !== 0 || naPasku || kontener.scrollWidth <= kontener.clientWidth) return
    start = { x: z.clientX, przewiniecie: kontener.scrollLeft }
    kontener.setPointerCapture(z.pointerId)
    kontener.classList.add('ramki--przeciagane')
  })
  kontener.addEventListener('pointermove', (z) => {
    if (start) kontener.scrollLeft = start.przewiniecie - (z.clientX - start.x)
  })
  const koniec = () => {
    start = null
    kontener.classList.remove('ramki--przeciagane')
  }
  kontener.addEventListener('pointerup', koniec)
  kontener.addEventListener('pointercancel', koniec)
}

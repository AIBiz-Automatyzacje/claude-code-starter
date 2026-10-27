// Strona narzedzia makiet (P24 IU-7): ekrany z punktow wizualnych smoke'u, aplikacja w ramkach urzadzen po lewej, makieta 1:1
// po prawej, decyzje „Zgodne”, „Odstępstwo OK” i „Zgłoś błąd” zapisywane do linii checklisty przez API serwera. Token z linku
// (`?t=`) trafia do sessionStorage i znika z paska adresu; API dostaje go w naglowku, SSE — w query (EventSource nie ma naglowkow).
// Zmiany sesji (SSE `punkty`) odswiezaja liste z zachowaniem biezacego ekranu; `przeladuj` (po poprawce) stawia ramki od nowa
// na trasie punktu.

import { PRESETY, domyslneUrzadzenia, urzadzenieZWymiaru } from '../urzadzenia.mjs'
import { podepnijPanelSieci } from './panel-sieci.mjs'
import { adresZRamki, bezpiecznaTrasa, przeciaganieRzedu, przeladujRamki, przeniesRamki, skalujRamki, ustawRamki, zapisanyWybor, zapiszWybor } from './ramki.mjs'
import { liczebnik } from './teksty.mjs'
import { podepnijRozdzielacz } from './uklad.mjs'
import { podepnijZrzut } from './zrzut.mjs'

const API = '/__makieta/api/'
const KLUCZ_TOKENU = 'makieta.token'
const KLUCZ_EKRANU = 'makieta.ekran'
const STATUSY = { otwarty: 'otwarty', zgodny: 'zgodny', odstepstwo: 'odstępstwo', blad: 'błąd zgłoszony', poprawione: 'poprawione, do sprawdzenia' }
const KONFLIKT = 'Sesja zmieniła ten punkt w międzyczasie — odświeżyłem go, oceń jeszcze raz.'
const BRAK_SERWERA = 'Serwer narzędzia nie odpowiada — w sesji sprawdź „makieta.mjs stan” i otwórz nowy link po starcie.'

/**
 * @typedef {import('../urzadzenia.mjs').Urzadzenie} Urzadzenie
 * @typedef {{ id: string, linia: number, tekst: string, tresc: string, status: keyof typeof STATUSY, ekrany: string[], trasa: string | null,
 *   trasaStartowa: string, viewport: { szerokosc: number, wysokosc: number } | null, niejednoznaczny: boolean,
 *   opis: { co: string, wejscie?: string, stany: string | null, sprawdz: string } | null }} Punkt
 * @typedef {{ punkt: string, ekran: string, makieta: string | null, url: string | null, spec: string | null, wymiary: { szerokosc: number, wysokosc: number } | null }} Ekran
 * @typedef {{ smoke: string, zadanie: string, aplikacja: string, punkty: Punkt[], ekrany: Ekran[], pominiete: string[], ostrzezenia: string[],
 *   zgloszenia: 'na-koniec' | 'od-razu' }} Dane
 */

/**
 * @template {HTMLElement} T
 * @param {string} id
 * @param {new () => T} typ
 * @returns {T}
 */
function el(id, typ) {
  const e = document.getElementById(id)
  if (!(e instanceof typ)) throw new Error(`brak elementu #${id}`)
  return e
}

/** @param {() => string | null} czytaj @returns {string | null} odczyt sessionStorage odporny na brak dostepu */
function bezpiecznie(czytaj) {
  try {
    return czytaj()
  } catch {
    // Prywatne okno albo zablokowane dane strony — dzialamy bez zapamietywania.
    return null
  }
}

const adres = new URL(location.href)
const tokenZLinku = adres.searchParams.get('t')
if (tokenZLinku) {
  bezpiecznie(() => { sessionStorage.setItem(KLUCZ_TOKENU, tokenZLinku); return null })
  adres.searchParams.delete('t')
  history.replaceState(null, '', adres.pathname + adres.search)
}
const token = tokenZLinku ?? bezpiecznie(() => sessionStorage.getItem(KLUCZ_TOKENU)) ?? ''

/** @type {{ dane: Dane | null, indeks: number, urzadzenia: Urzadzenie[], trasa: string, skala: import('./ramki.mjs').TrybSkali }} */
const stan = { dane: null, indeks: Number(bezpiecznie(() => sessionStorage.getItem(KLUCZ_EKRANU)) ?? 0) || 0, urzadzenia: [], trasa: '/', skala: 'przewijaj' }

/** @param {string} tekst */
const komunikat = (tekst) => { el('komunikat', HTMLParagraphElement).textContent = tekst }

/** @param {string} sciezka @param {RequestInit} [opcje] @returns {Promise<{ status: number, json: any }>} */
async function api(sciezka, opcje = {}) {
  try {
    const odp = await fetch(`${API}${sciezka}`, { ...opcje, headers: { 'x-makieta-token': token, 'content-type': 'application/json', ...opcje.headers }, signal: AbortSignal.timeout(10_000) })
    return { status: odp.status, json: await odp.json().catch(() => null) }
  } catch {
    // Siec albo limit czasu: serwer narzedzia zatrzymany — status 0 i komunikat dla operatora zamiast cichego wyjatku.
    return { status: 0, json: { error: { message: BRAK_SERWERA } } }
  }
}

/** @returns {{ ekran: Ekran, punkt: Punkt } | null} */
function biezacy() {
  const ekran = stan.dane?.ekrany[stan.indeks]
  const punkt = ekran && stan.dane?.punkty.find((p) => p.id === ekran.punkt)
  return ekran && punkt ? { ekran, punkt } : null
}

/** @param {{ ekran: Ekran, punkt: Punkt }} b @returns {Urzadzenie[]} */
const urzadzeniaEkranu = (b) => zapisanyWybor() ?? domyslneUrzadzenia(b.ekran.wymiary, b.punkt.tresc)

const skaluj = () => skalujRamki(el('ramki', HTMLDivElement), stan.urzadzenia, stan.skala)

function rysujRamki() {
  ustawRamki(el('ramki', HTMLDivElement), stan.urzadzenia, stan.trasa, stan.skala)
  el('adres', HTMLInputElement).value = stan.trasa
  const wybor = el('urzadzenie-bledu', HTMLSelectElement)
  wybor.replaceChildren(...stan.urzadzenia.map((u) => new Option(`${u.nazwa} (${u.szerokosc} px)`, u.id)))
  const lista = el('lista-urzadzen', HTMLDivElement)
  lista.replaceChildren(...[...PRESETY, ...stan.urzadzenia.filter((u) => !PRESETY.some((p) => p.id === u.id))].map((u) => {
    const etykieta = document.createElement('label')
    const pole = document.createElement('input')
    pole.type = 'checkbox'
    pole.checked = stan.urzadzenia.some((x) => x.id === u.id)
    pole.addEventListener('change', () => {
      const nowe = pole.checked ? [...stan.urzadzenia, u] : stan.urzadzenia.filter((x) => x.id !== u.id)
      if (!nowe.length) { pole.checked = true; return }
      stan.urzadzenia = nowe
      zapiszWybor(nowe)
      rysujRamki()
    })
    etykieta.append(pole, ` ${u.nazwa} ${u.szerokosc}×${u.wysokosc}`)
    return etykieta
  }))
}

/**
 * Opis punktu dla operatora (Jak wejść / Sprawdź / Stany / Gdzie; „Jak wejść” tylko w formacie trzech pol); pelna linia checklisty tylko na zadanie. Punkt spoza formatu (opis null)
 * pokazuje od razu cala linie.
 * @param {Punkt} punkt
 */
function ustawOpis(punkt) {
  const tresc = el('tresc', HTMLParagraphElement)
  const przelacznik = el('cala-tresc', HTMLButtonElement)
  const { opis } = punkt
  el('opis', HTMLElement).hidden = !opis
  el('opis-sprawdz', HTMLElement).textContent = opis?.sprawdz ?? ''
  el('opis-stany', HTMLElement).textContent = opis?.stany ?? ''
  el('opis-stany-wiersz', HTMLDivElement).hidden = !opis?.stany
  el('opis-co', HTMLElement).textContent = opis?.co ?? ''
  el('opis-wejscie', HTMLElement).textContent = opis?.wejscie ?? ''
  el('opis-wejscie-wiersz', HTMLDivElement).hidden = !opis?.wejscie
  if (tresc.textContent === punkt.tresc) return
  tresc.textContent = punkt.tresc
  tresc.hidden = Boolean(opis)
  przelacznik.hidden = !opis
  przelacznik.setAttribute('aria-expanded', 'false')
  przelacznik.textContent = 'Pokaż całą linię'
}

/** @param {{ zmienTrase?: boolean }} [opcje] zmienTrase: ramki od nowa na trasie punktu (zmiana ekranu) */
function rysujEkran({ zmienTrase = true } = {}) {
  const dane = stan.dane
  const b = biezacy()
  el('licznik', HTMLSpanElement).textContent = dane ? `ekran ${dane.ekrany.length ? stan.indeks + 1 : 0}/${dane.ekrany.length}` : ''
  el('decyzje', HTMLDivElement).hidden = !b
  if (dane && !dane.ekrany.length) komunikat('Smoke nie ma punktów wizualnych z makietą visual-diff/<ekran>-figma.png.')
  if (!dane || !b) return
  bezpiecznie(() => { sessionStorage.setItem(KLUCZ_EKRANU, String(stan.indeks)); return null })
  const { ekran, punkt } = b
  const status = el('status', HTMLSpanElement)
  status.textContent = STATUSY[punkt.status]
  status.className = `status status--${punkt.status}`
  el('ekran', HTMLSpanElement).textContent = ekran.ekran
  el('trasa', HTMLElement).textContent = punkt.trasa ?? '/ (punkt bez trasy)'
  ustawOpis(punkt)
  el('decyzje', HTMLDivElement).hidden = punkt.niejednoznaczny
  el('niejednoznaczny', HTMLParagraphElement).hidden = !punkt.niejednoznaczny
  const podpowiedz = el('podpowiedz-trasy', HTMLParagraphElement)
  podpowiedz.hidden = !punkt.trasa?.includes('<')
  podpowiedz.textContent = `Pełna trasa z punktu: ${punkt.trasa ?? ''} — uzupełnij ją w pasku adresu.`
  const obraz = el('obraz-makiety', HTMLImageElement)
  el('brak-makiety', HTMLParagraphElement).hidden = Boolean(ekran.url)
  obraz.hidden = !ekran.url
  if (ekran.url) obraz.src = ekran.url
  obraz.style.width = ekran.wymiary ? `${ekran.wymiary.szerokosc}px` : ''
  el('wymiary-makiety', HTMLSpanElement).textContent = ekran.wymiary ? `${ekran.wymiary.szerokosc}×${ekran.wymiary.wysokosc}` : ''
  if (zmienTrase) {
    stan.trasa = punkt.trasaStartowa
    stan.urzadzenia = urzadzeniaEkranu(b)
    rysujRamki()
  }
}

/** @param {{ zmienTrase?: boolean }} [opcje] */
async function wczytaj(opcje) {
  const poprzedni = biezacy()
  const { status, json } = await api('punkty')
  if (status !== 200) return komunikat(json?.error?.message ?? `Serwer narzędzia odpowiedział ${status}.`)
  /** @type {Dane} */
  const dane = json.data
  stan.dane = dane
  const zachowany = poprzedni ? dane.ekrany.findIndex((e) => e.punkt === poprzedni.ekran.punkt && e.ekran === poprzedni.ekran.ekran) : -1
  stan.indeks = Math.min(Math.max(zachowany === -1 ? stan.indeks : zachowany, 0), Math.max(dane.ekrany.length - 1, 0))
  el('smoke', HTMLSpanElement).textContent = dane.smoke
  const teksty = [...dane.ostrzezenia, ...(dane.pominiete.length ? [`Ekrany SPEC bez punktu w checkliście: ${dane.pominiete.join(', ')} — dopisz punkt, żeby ocenić je tutaj.`] : [])]
  el('uwagi-naglowek', HTMLElement).textContent = teksty.length ? `Uwagi narzędzia (${teksty.length})` : 'Checklista'
  el('uwagi-tresc', HTMLParagraphElement).textContent = teksty.join(' ')
  const naKoniec = dane.zgloszenia === 'na-koniec'
  el('zakoncz', HTMLButtonElement).hidden = !naKoniec
  el('wyslij-blad', HTMLButtonElement).textContent = naKoniec ? 'Zapisz zgłoszenie' : 'Wyślij do sesji'
  rysujEkran(opcje)
}

/** @param {number} krok */
function przejdz(krok) {
  const n = stan.dane?.ekrany.length ?? 0
  if (!n) return
  stan.indeks = (stan.indeks + krok + n) % n
  komunikat('')
  ukryjFormularze()
  rysujEkran()
}

function ukryjFormularze() {
  el('form-odstepstwo', HTMLFormElement).hidden = true
  el('form-blad', HTMLFormElement).hidden = true
  el('form-koniec', HTMLFormElement).hidden = true
}

/** @param {Punkt[]} punkty @returns {string} stan przegladu przed wyslaniem zgloszen do sesji */
function tekstPodsumowania(punkty) {
  const ile = (/** @type {Punkt['status']} */ s) => punkty.filter((p) => p.status === s).length
  const otwarte = ile('otwarty') + ile('poprawione')
  return `Zgodne: ${ile('zgodny')}, odstępstwa: ${ile('odstepstwo')}, zgłoszone błędy: ${ile('blad')}, bez decyzji: ${otwarte}.`
    + (otwarte ? ' Punkty bez decyzji zostaną w checkliście — możesz do nich wrócić później.' : '')
    + ' Sesja dostanie wszystkie zgłoszenia naraz i przygotuje z Tobą dokument ustaleń.'
}

async function zakonczPrzeglad() {
  const wyslij = document.querySelector('#form-koniec button[type="submit"]')
  if (!(wyslij instanceof HTMLButtonElement) || wyslij.disabled) return
  // Drugie klikniecie w trakcie wysylania dalo sesji drugie zdarzenie konca przegladu z tymi samymi zgloszeniami.
  wyslij.disabled = true
  const { status, json } = await api('zakoncz', { method: 'POST' }).finally(() => { wyslij.disabled = false })
  if (status !== 200) return komunikat(json?.error?.message ?? `Wysłanie nie powiodło się (${status}).`)
  ukryjFormularze()
  komunikat(`Wysłane do sesji: ${liczebnik(json.data.zgloszenia, ['zgłoszenie', 'zgłoszenia', 'zgłoszeń'])}. Wróć do sesji smoke'u — tam ustalicie, co poprawić.`)
}

/**
 * @param {'zgodne' | 'odstepstwo' | 'blad'} decyzja
 * @param {{ notatka?: string, urzadzenie?: Urzadzenie, zrzut?: string }} [dane]
 * @returns {Promise<boolean>} czy zapisano (formularz czysci pole tylko po zapisie)
 */
async function zapisz(decyzja, { notatka, urzadzenie, zrzut } = {}) {
  const b = biezacy()
  if (!b) return false
  const przyciski = document.querySelectorAll('#decyzje button, .formularz button[type="submit"]')
  // Drugie klikniecie w trakcie zapisu dostaloby 409 i komunikat konfliktu po udanym zapisie.
  for (const p of przyciski) if (p instanceof HTMLButtonElement) p.disabled = true
  try {
    const cialo = { punkt: b.punkt.id, linia: b.punkt.tekst, decyzja, notatka, ekran: b.ekran.ekran, urzadzenie: urzadzenie?.nazwa, szerokosc: urzadzenie?.szerokosc, zrzut }
    const { status, json } = await api('decyzja', { method: 'POST', body: JSON.stringify(cialo) })
    if (status === 409) {
      await wczytaj({ zmienTrase: false })
      komunikat(KONFLIKT)
      return false
    }
    if (status !== 200) {
      komunikat(json?.error?.message ?? `Zapis nie powiódł się (${status}).`)
      return false
    }
    ukryjFormularze()
    await wczytaj({ zmienTrase: false })
    const poBledzie = stan.dane?.zgloszenia === 'na-koniec' ? 'Zgłoszenie zapisane w checkliście — trafi do sesji po „Zakończ przegląd”.' : 'Zgłoszenie zapisane w checkliście i wysłane do sesji smoke\'u.'
    komunikat(json?.data?.ostrzezenie ?? (decyzja === 'blad' ? poBledzie : 'Zapisane w checkliście.'))
    return true
  } finally {
    for (const p of przyciski) if (p instanceof HTMLButtonElement) p.disabled = false
  }
}

/**
 * „Zgłoś błąd”: najpierw zrzut (jesli jest) do `api/zrzut`, potem decyzja ze sciezka zrzutu — linia checklisty dostaje
 * zgloszenie dopiero, gdy zrzut juz lezy w katalogu zadania.
 * @param {{ notatka: string, urzadzenie: Urzadzenie, zrzuty: ReturnType<typeof podepnijZrzut> }} o
 * @returns {Promise<boolean>} czy zapisano
 */
async function zglosBlad({ notatka, urzadzenie, zrzuty }) {
  const b = biezacy()
  const png = await zrzuty.png()
  /** @type {string | undefined} */
  let zrzut
  if (b && png) {
    const { status, json } = await api(`zrzut?punkt=${encodeURIComponent(b.punkt.id)}`, { method: 'POST', body: png, headers: { 'content-type': 'image/png' } })
    if (status !== 200) {
      komunikat(status === 413 ? 'Zrzut większy niż 5 MB — zaznacz mniejszy fragment.' : json?.error?.message ?? `Zrzut nie zapisał się (${status}).`)
      return false
    }
    zrzut = json.data.zrzut
  }
  const ok = await zapisz('blad', { notatka, urzadzenie, zrzut })
  if (ok) zrzuty.wyczysc()
  return ok
}

function podepnij() {
  el('poprzedni', HTMLButtonElement).addEventListener('click', () => przejdz(-1))
  el('nastepny', HTMLButtonElement).addEventListener('click', () => przejdz(1))
  document.addEventListener('keydown', (z) => {
    if (z.target instanceof HTMLInputElement || z.target instanceof HTMLTextAreaElement || z.target instanceof HTMLSelectElement) return
    // Strzalki na rozdzielaczu zmieniaja szerokosc kolumn, nie ekran.
    if (z.target instanceof HTMLElement && z.target.getAttribute('role') === 'separator') return
    if (z.key === 'ArrowLeft') przejdz(-1)
    if (z.key === 'ArrowRight') przejdz(1)
  })
  el('zgodne', HTMLButtonElement).addEventListener('click', () => void zapisz('zgodne'))
  el('odstepstwo', HTMLButtonElement).addEventListener('click', () => { ukryjFormularze(); el('form-odstepstwo', HTMLFormElement).hidden = false; el('notatka-odstepstwa', HTMLTextAreaElement).focus() })
  el('blad', HTMLButtonElement).addEventListener('click', () => { ukryjFormularze(); el('form-blad', HTMLFormElement).hidden = false; el('opis-bledu', HTMLTextAreaElement).focus() })
  for (const anuluj of document.querySelectorAll('.anuluj')) anuluj.addEventListener('click', ukryjFormularze)
  el('cala-tresc', HTMLButtonElement).addEventListener('click', (z) => {
    const tresc = el('tresc', HTMLParagraphElement)
    tresc.hidden = !tresc.hidden
    if (!(z.currentTarget instanceof HTMLButtonElement)) return
    z.currentTarget.setAttribute('aria-expanded', String(!tresc.hidden))
    z.currentTarget.textContent = tresc.hidden ? 'Pokaż całą linię' : 'Ukryj linię'
  })
  el('zakoncz', HTMLButtonElement).addEventListener('click', () => {
    ukryjFormularze()
    el('podsumowanie', HTMLParagraphElement).textContent = tekstPodsumowania(stan.dane?.punkty ?? [])
    el('form-koniec', HTMLFormElement).hidden = false
  })
  el('form-koniec', HTMLFormElement).addEventListener('submit', (z) => { z.preventDefault(); void zakonczPrzeglad() })
  el('form-odstepstwo', HTMLFormElement).addEventListener('submit', (z) => {
    z.preventDefault()
    const notatka = el('notatka-odstepstwa', HTMLTextAreaElement).value.trim()
    if (!notatka) return komunikat('Wpisz, co się różni i dlaczego to OK.')
    void zapisz('odstepstwo', { notatka }).then((ok) => { if (ok) el('notatka-odstepstwa', HTMLTextAreaElement).value = '' })
  })
  const zrzuty = podepnijZrzut({ formularz: el('form-blad', HTMLFormElement), pole: el('zrzut-bledu', HTMLInputElement), podglad: el('podglad-zrzutu', HTMLCanvasElement),
    usun: el('usun-zrzut', HTMLButtonElement), komunikat })
  el('form-blad', HTMLFormElement).addEventListener('submit', (z) => {
    z.preventDefault()
    const notatka = el('opis-bledu', HTMLTextAreaElement).value.trim()
    const urzadzenie = stan.urzadzenia.find((u) => u.id === el('urzadzenie-bledu', HTMLSelectElement).value) ?? stan.urzadzenia[0]
    if (!notatka || !urzadzenie) return komunikat('Wpisz, co jest nie tak.')
    void zglosBlad({ notatka, urzadzenie, zrzuty }).then((ok) => { if (ok) el('opis-bledu', HTMLTextAreaElement).value = '' })
  })
  el('form-adres', HTMLFormElement).addEventListener('submit', (z) => {
    z.preventDefault()
    stan.trasa = bezpiecznaTrasa(el('adres', HTMLInputElement).value.trim()) ?? '/'
    rysujRamki()
  })
  const pole = el('adres', HTMLInputElement)
  const razem = el('razem', HTMLInputElement)
  // Adres zgloszony przez skrypt w ramce (P27 S3): „Ramki razem” przenosi pozostale ramki, pasek adresu pokazuje adres ramki
  // (wpisu operatora w trakcie pisania nie nadpisuje).
  window.addEventListener('message', (z) => {
    const trasa = adresZRamki(el('ramki', HTMLDivElement), z, { origin: location.origin, razem: razem.checked })
    if (!trasa) return
    stan.trasa = trasa
    if (document.activeElement !== pole) pole.value = trasa
  })
  // Wlaczenie „Ramki razem” zrownuje ramki na adresie z paska; bez niego ramki ida tam przyciskiem.
  razem.addEventListener('change', () => {
    el('tutaj', HTMLButtonElement).hidden = razem.checked
    if (razem.checked) przeniesRamki(el('ramki', HTMLDivElement), stan.trasa)
  })
  el('tutaj', HTMLButtonElement).addEventListener('click', () => przeniesRamki(el('ramki', HTMLDivElement), stan.trasa))
  el('przeladuj', HTMLButtonElement).addEventListener('click', () => przeladujRamki(el('ramki', HTMLDivElement), stan.trasa))
  el('w-karcie', HTMLButtonElement).addEventListener('click', () => window.open(stan.trasa, '_blank', 'noopener'))
  const przyciskiSkali = [...document.querySelectorAll('[data-skala]')].filter((p) => p instanceof HTMLButtonElement)
  for (const przycisk of przyciskiSkali) {
    przycisk.addEventListener('click', () => {
      const tryb = przycisk.dataset.skala
      if (tryb !== 'przewijaj' && tryb !== 'wszystkie' && tryb !== '1:1') return
      stan.skala = tryb
      for (const p of przyciskiSkali) p.setAttribute('aria-pressed', String(p === przycisk))
      skaluj()
    })
  }
  przeciaganieRzedu(el('ramki', HTMLDivElement))
  podepnijPanelSieci({ panel: el('siec', HTMLDetailsElement), naglowek: el('siec-naglowek', HTMLElement), opoznienie: el('opoznienie', HTMLSelectElement),
    blokady: el('blokady', HTMLTextAreaElement), formularz: el('form-siec', HTMLFormElement), stan: el('siec-stan', HTMLParagraphElement), ramki: el('ramki', HTMLDivElement) })
  let klatka = 0
  // Zmiana udzialu przy przeciaganiu przychodzi co ruch wskaznika — skala ramek raz na klatke.
  podepnijRozdzielacz({ uklad: document.querySelector('.uklad') ?? document.body, rozdzielacz: el('rozdzielacz', HTMLDivElement),
    poZmianie: () => { cancelAnimationFrame(klatka); klatka = requestAnimationFrame(skaluj) } })
  el('dopasuj', HTMLButtonElement).addEventListener('click', (z) => {
    const wlaczone = document.querySelector('.makieta')?.classList.toggle('makieta--dopasuj') ?? false
    if (z.currentTarget instanceof HTMLButtonElement) z.currentTarget.setAttribute('aria-pressed', String(wlaczone))
  })
  el('domyslne', HTMLButtonElement).addEventListener('click', () => {
    zapiszWybor(null)
    const b = biezacy()
    if (b) { stan.urzadzenia = urzadzeniaEkranu(b); rysujRamki() }
  })
  el('form-wymiar', HTMLFormElement).addEventListener('submit', (z) => {
    z.preventDefault()
    const u = urzadzenieZWymiaru(el('wymiar', HTMLInputElement).value)
    if (!u) return komunikat('Wymiar w zapisie szerokość×wysokość, np. 390×844.')
    stan.urzadzenia = [...stan.urzadzenia.filter((x) => x.id !== u.id), u]
    zapiszWybor(stan.urzadzenia)
    rysujRamki()
  })
  let doRysowania = 0
  // Zmiana okna (takze otwarcie DevTools) tylko skaluje ramki — aplikacja w nich zachowuje stan.
  window.addEventListener('resize', () => { clearTimeout(doRysowania); doRysowania = window.setTimeout(skaluj, 150) })
  const zdarzenia = new EventSource(`${API}zdarzenia?t=${encodeURIComponent(token)}`)
  // EventSource po 403 (restart narzedzia z nowym tokenem) zamyka sie na stale — operator musi otworzyc nowy link.
  zdarzenia.addEventListener('error', () => {
    if (zdarzenia.readyState === EventSource.CLOSED) komunikat(BRAK_SERWERA)
  })
  zdarzenia.addEventListener('punkty', () => void wczytaj({ zmienTrase: false }))
  // Po poprawce sesji ramki wracaja na trase punktu (HMR Vite i tak odswiezy moduly) — od nowa, bo „Przeładuj ramki”
  // zostaje na biezacym adresie kazdej ramki.
  zdarzenia.addEventListener('przeladuj', () => {
    stan.trasa = biezacy()?.punkt.trasaStartowa ?? stan.trasa
    rysujRamki()
    void wczytaj({ zmienTrase: false })
  })
}

podepnij()
void wczytaj()

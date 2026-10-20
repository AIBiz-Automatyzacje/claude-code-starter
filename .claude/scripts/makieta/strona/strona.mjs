// Strona narzedzia makiet (P24 IU-7): ekrany z punktow wizualnych smoke'u, aplikacja w ramkach urzadzen po lewej, makieta 1:1
// po prawej, decyzje „Zgodne”, „Odstępstwo OK” i „Zgłoś błąd” zapisywane do linii checklisty przez API serwera. Token z linku
// (`?t=`) trafia do sessionStorage i znika z paska adresu; API dostaje go w naglowku, SSE — w query (EventSource nie ma naglowkow).
// Zmiany sesji (SSE `punkty`) odswiezaja liste z zachowaniem biezacego ekranu; `przeladuj` (po poprawce) przeladowuje ramki.

import { PRESETY, domyslneUrzadzenia, urzadzenieZWymiaru } from '../urzadzenia.mjs'
import { przeladujRamki, ustawRamki, zapisanyWybor, zapiszWybor } from './ramki.mjs'

const API = '/__makieta/api/'
const KLUCZ_TOKENU = 'makieta.token'
const KLUCZ_EKRANU = 'makieta.ekran'
const STATUSY = { otwarty: 'otwarty', zgodny: 'zgodny', odstepstwo: 'odstępstwo', blad: 'błąd zgłoszony', poprawione: 'poprawione, do sprawdzenia' }
const KONFLIKT = 'Sesja zmieniła ten punkt w międzyczasie — odświeżyłem go, oceń jeszcze raz.'

/**
 * @typedef {import('../urzadzenia.mjs').Urzadzenie} Urzadzenie
 * @typedef {{ id: string, linia: number, tekst: string, tresc: string, status: keyof typeof STATUSY, ekrany: string[], trasa: string | null,
 *   trasaStartowa: string, viewport: { szerokosc: number, wysokosc: number } | null, niejednoznaczny: boolean }} Punkt
 * @typedef {{ punkt: string, ekran: string, makieta: string | null, url: string | null, spec: string | null, wymiary: { szerokosc: number, wysokosc: number } | null }} Ekran
 * @typedef {{ smoke: string, zadanie: string, aplikacja: string, punkty: Punkt[], ekrany: Ekran[], pominiete: string[], ostrzezenia: string[] }} Dane
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

/** @type {{ dane: Dane | null, indeks: number, urzadzenia: Urzadzenie[], trasa: string, jedenDoJednego: boolean }} */
const stan = { dane: null, indeks: Number(bezpiecznie(() => sessionStorage.getItem(KLUCZ_EKRANU)) ?? 0) || 0, urzadzenia: [], trasa: '/', jedenDoJednego: false }

/** @param {string} tekst */
const komunikat = (tekst) => { el('komunikat', HTMLParagraphElement).textContent = tekst }

/** @param {string} sciezka @param {RequestInit} [opcje] @returns {Promise<{ status: number, json: any }>} */
async function api(sciezka, opcje = {}) {
  const odp = await fetch(`${API}${sciezka}`, { ...opcje, headers: { 'x-makieta-token': token, 'content-type': 'application/json', ...opcje.headers }, signal: AbortSignal.timeout(10_000) })
  return { status: odp.status, json: await odp.json().catch(() => null) }
}

/** @returns {{ ekran: Ekran, punkt: Punkt } | null} */
function biezacy() {
  const ekran = stan.dane?.ekrany[stan.indeks]
  const punkt = ekran && stan.dane?.punkty.find((p) => p.id === ekran.punkt)
  return ekran && punkt ? { ekran, punkt } : null
}

/** @param {{ ekran: Ekran, punkt: Punkt }} b @returns {Urzadzenie[]} */
const urzadzeniaEkranu = (b) => zapisanyWybor() ?? domyslneUrzadzenia(b.ekran.wymiary, b.punkt.tresc)

function rysujRamki() {
  ustawRamki(el('ramki', HTMLDivElement), stan.urzadzenia, stan.trasa, { jedenDoJednego: stan.jedenDoJednego })
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

/** @param {{ zmienTrase?: boolean }} [opcje] zmienTrase: ramki od nowa na trasie punktu (zmiana ekranu) */
function rysujEkran({ zmienTrase = true } = {}) {
  const dane = stan.dane
  const b = biezacy()
  el('licznik', HTMLSpanElement).textContent = dane ? `ekran ${dane.ekrany.length ? stan.indeks + 1 : 0}/${dane.ekrany.length}` : ''
  if (!dane || !b) return
  bezpiecznie(() => { sessionStorage.setItem(KLUCZ_EKRANU, String(stan.indeks)); return null })
  const { ekran, punkt } = b
  const status = el('status', HTMLSpanElement)
  status.textContent = STATUSY[punkt.status]
  status.className = `status status--${punkt.status}`
  el('ekran', HTMLSpanElement).textContent = ekran.ekran
  el('trasa', HTMLElement).textContent = punkt.trasa ?? '/ (punkt bez trasy)'
  el('tresc', HTMLParagraphElement).textContent = punkt.tresc
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
  const uwagi = el('uwagi', HTMLParagraphElement)
  const teksty = [...dane.ostrzezenia, ...(dane.pominiete.length ? [`Ekrany SPEC bez punktu w checkliście: ${dane.pominiete.join(', ')} — dopisz punkt, żeby ocenić je tutaj.`] : [])]
  uwagi.hidden = !teksty.length
  uwagi.textContent = teksty.join(' ')
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
}

/** @param {'zgodne' | 'odstepstwo' | 'blad'} decyzja @param {{ notatka?: string, urzadzenie?: Urzadzenie }} [dane] */
async function zapisz(decyzja, { notatka, urzadzenie } = {}) {
  const b = biezacy()
  if (!b) return
  const cialo = { punkt: b.punkt.id, linia: b.punkt.tekst, decyzja, notatka, ekran: b.ekran.ekran, urzadzenie: urzadzenie?.nazwa, szerokosc: urzadzenie?.szerokosc }
  const { status, json } = await api('decyzja', { method: 'POST', body: JSON.stringify(cialo) })
  if (status === 409) {
    await wczytaj({ zmienTrase: false })
    return komunikat(KONFLIKT)
  }
  if (status !== 200) return komunikat(json?.error?.message ?? `Zapis nie powiódł się (${status}).`)
  ukryjFormularze()
  await wczytaj({ zmienTrase: false })
  komunikat(decyzja === 'blad' ? 'Zgłoszenie zapisane w checkliście i wysłane do sesji smoke\'u.' : 'Zapisane w checkliście.')
}

function podepnij() {
  el('poprzedni', HTMLButtonElement).addEventListener('click', () => przejdz(-1))
  el('nastepny', HTMLButtonElement).addEventListener('click', () => przejdz(1))
  document.addEventListener('keydown', (z) => {
    if (z.target instanceof HTMLInputElement || z.target instanceof HTMLTextAreaElement || z.target instanceof HTMLSelectElement) return
    if (z.key === 'ArrowLeft') przejdz(-1)
    if (z.key === 'ArrowRight') przejdz(1)
  })
  el('zgodne', HTMLButtonElement).addEventListener('click', () => void zapisz('zgodne'))
  el('odstepstwo', HTMLButtonElement).addEventListener('click', () => { ukryjFormularze(); el('form-odstepstwo', HTMLFormElement).hidden = false; el('notatka-odstepstwa', HTMLTextAreaElement).focus() })
  el('blad', HTMLButtonElement).addEventListener('click', () => { ukryjFormularze(); el('form-blad', HTMLFormElement).hidden = false; el('opis-bledu', HTMLTextAreaElement).focus() })
  for (const anuluj of document.querySelectorAll('.anuluj')) anuluj.addEventListener('click', ukryjFormularze)
  el('form-odstepstwo', HTMLFormElement).addEventListener('submit', (z) => {
    z.preventDefault()
    const notatka = el('notatka-odstepstwa', HTMLTextAreaElement).value.trim()
    if (notatka) void zapisz('odstepstwo', { notatka }).then(() => { el('notatka-odstepstwa', HTMLTextAreaElement).value = '' })
  })
  el('form-blad', HTMLFormElement).addEventListener('submit', (z) => {
    z.preventDefault()
    const notatka = el('opis-bledu', HTMLTextAreaElement).value.trim()
    const urzadzenie = stan.urzadzenia.find((u) => u.id === el('urzadzenie-bledu', HTMLSelectElement).value) ?? stan.urzadzenia[0]
    if (notatka && urzadzenie) void zapisz('blad', { notatka, urzadzenie }).then(() => { el('opis-bledu', HTMLTextAreaElement).value = '' })
  })
  el('form-adres', HTMLFormElement).addEventListener('submit', (z) => {
    z.preventDefault()
    const trasa = el('adres', HTMLInputElement).value.trim()
    stan.trasa = trasa.startsWith('/') && !trasa.startsWith('//') && !trasa.startsWith('/__makieta/') ? trasa : '/'
    rysujRamki()
  })
  el('przeladuj', HTMLButtonElement).addEventListener('click', () => przeladujRamki(el('ramki', HTMLDivElement), stan.trasa))
  el('w-karcie', HTMLButtonElement).addEventListener('click', () => window.open(stan.trasa, '_blank', 'noopener'))
  el('skala', HTMLButtonElement).addEventListener('click', (z) => {
    stan.jedenDoJednego = !stan.jedenDoJednego
    if (z.currentTarget instanceof HTMLButtonElement) z.currentTarget.setAttribute('aria-pressed', String(stan.jedenDoJednego))
    rysujRamki()
  })
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
  window.addEventListener('resize', () => { clearTimeout(doRysowania); doRysowania = window.setTimeout(rysujRamki, 150) })
  const zdarzenia = new EventSource(`${API}zdarzenia?t=${encodeURIComponent(token)}`)
  zdarzenia.addEventListener('punkty', () => void wczytaj({ zmienTrase: false }))
  // Po poprawce sesji ramki wracaja na trase punktu (HMR Vite i tak odswiezy moduly).
  zdarzenia.addEventListener('przeladuj', () => {
    stan.trasa = biezacy()?.punkt.trasaStartowa ?? stan.trasa
    el('adres', HTMLInputElement).value = stan.trasa
    przeladujRamki(el('ramki', HTMLDivElement), stan.trasa)
    void wczytaj({ zmienTrase: false })
  })
}

podepnij()
void wczytaj()

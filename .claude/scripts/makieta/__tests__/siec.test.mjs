// Skrypt sieci w ramkach aplikacji (P28 (5)): klasyczny skrypt strona/siec.mjs wykonany w piaskownicy node:vm z atrapa
// fetch, XMLHttpRequest i localStorage — opoznienie i blokada wedlug ustawien zapisanych przez strone narzedzia.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createContext, runInContext } from 'node:vm'
import assert from 'node:assert/strict'
import test from 'node:test'

const SKRYPT = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'strona', 'siec.mjs'), 'utf8')

/** @param {unknown} ustawienia zapis `makieta.siec` w localStorage (null = brak) */
function piaskownica(ustawienia) {
  /** @type {Map<string, string>} */
  const pamiec = new Map(ustawienia === null ? [] : [['makieta.siec', JSON.stringify(ustawienia)]])
  /** @type {string[]} */
  const pobrania = []
  class AtrapaXhr extends EventTarget {
    /** @param {string} _metoda @param {string} url */
    open(_metoda, url) { this.url = url }
    send() { pobrania.push(`xhr ${this.url}`) }
  }
  const okno = {
    location: { href: 'http://127.0.0.1:5180/p/x' }, URL, Request, TypeError, EventTarget, ProgressEvent: Event, setTimeout, Date,
    localStorage: { getItem: (/** @type {string} */ k) => pamiec.get(k) ?? null },
    fetch: async (/** @type {unknown} */ wejscie) => { pobrania.push(String(wejscie instanceof Request ? wejscie.url : wejscie)); return 'odpowiedz' },
    XMLHttpRequest: AtrapaXhr,
  }
  const kontekst = createContext(okno)
  runInContext('var window = globalThis', kontekst)
  runInContext(SKRYPT, kontekst)
  return { okno: /** @type {any} */ (kontekst), pobrania, pamiec }
}

test('bez ustawień fetch przechodzi od razu; skrypt oznacza okno (strona narzędzia sprawdza, że działa w ramce)', async () => {
  const { okno, pobrania } = piaskownica(null)
  assert.equal(okno.__makietaSiec, true)
  assert.equal(await okno.fetch('/api/a'), 'odpowiedz')
  assert.deepEqual(pobrania, ['/api/a'])
})

test('blokada wzorcem z * (dopasowanie fragmentu adresu): fetch odrzucony TypeError jak w DevTools, inne adresy przechodzą', async () => {
  const { okno, pobrania } = piaskownica({ opoznienieMs: 0, blokady: ['*/api/komentarze*'] })
  await assert.rejects(okno.fetch('/api/komentarze?x=1'), (b) => b instanceof TypeError && /zablokowane/.test(String(b.message)))
  await assert.rejects(okno.fetch(new Request('http://127.0.0.1:5180/api/komentarze')), TypeError)
  assert.equal(await okno.fetch('https://abc.supabase.co/rest/v1/projekty'), 'odpowiedz')
  assert.deepEqual(pobrania, ['https://abc.supabase.co/rest/v1/projekty'])
})

test('opóźnienie czytane przy każdym żądaniu: zmiana ustawień działa bez przeładowania ramki', async () => {
  const { okno, pamiec } = piaskownica({ opoznienieMs: 0, blokady: [] })
  let t = Date.now()
  await okno.fetch('/a')
  assert.ok(Date.now() - t < 100)
  pamiec.set('makieta.siec', JSON.stringify({ opoznienieMs: 250, blokady: [] }))
  t = Date.now()
  await okno.fetch('/a')
  assert.ok(Date.now() - t >= 240, `opóźnienie ${Date.now() - t} ms`)
})

test('XMLHttpRequest: zablokowany adres dostaje zdarzenie error bez wysłania; dozwolony idzie dalej', async () => {
  const { okno, pobrania } = piaskownica({ opoznienieMs: 0, blokady: ['/api/glosy'] })
  const zly = new okno.XMLHttpRequest()
  const blad = new Promise((ok) => zly.addEventListener('error', () => ok('error')))
  zly.open('POST', '/api/glosy/gosc')
  zly.send('{}')
  assert.equal(await blad, 'error')
  const dobry = new okno.XMLHttpRequest()
  dobry.open('GET', '/api/inne')
  dobry.send()
  await new Promise((ok) => setTimeout(ok, 20))
  assert.deepEqual(pobrania, ['xhr /api/inne'])
})

test('uszkodzony zapis ustawień = bez ograniczeń (aplikacja działa normalnie)', async () => {
  const { okno, pamiec } = piaskownica(null)
  pamiec.set('makieta.siec', '{zepsute')
  assert.equal(await okno.fetch('/a'), 'odpowiedz')
  pamiec.set('makieta.siec', JSON.stringify({ opoznienieMs: 'dużo', blokady: 'x' }))
  assert.equal(await okno.fetch('/a'), 'odpowiedz')
})

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
    abort() { pobrania.push(`abort ${this.url}`) }
  }
  const okno = {
    location: { href: 'http://127.0.0.1:5180/p/x' }, URL, Request, TypeError, EventTarget, ProgressEvent: Event, Event, DOMException, setTimeout, Date,
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

test('po recenzji: zablokowany XHR wysyła readystatechange, error i loadend (biblioteki czytające tylko onreadystatechange nie wiszą)', async () => {
  const { okno } = piaskownica({ opoznienieMs: 0, blokady: ['/api/x'] })
  const x = new okno.XMLHttpRequest()
  /** @type {string[]} */
  const zdarzenia = []
  for (const n of ['readystatechange', 'error', 'loadend']) x.addEventListener(n, () => zdarzenia.push(n))
  x.open('GET', '/api/x')
  x.send()
  await new Promise((ok) => setTimeout(ok, 20))
  assert.deepEqual(zdarzenia, ['readystatechange', 'error', 'loadend'])
})

test('po recenzji: XHR z opóźnieniem wysłany po czasie; abort w trakcie opóźnienia = bez wysłania; synchroniczny bez opóźnienia, zablokowany rzuca NetworkError', async () => {
  const { okno, pobrania } = piaskownica({ opoznienieMs: 200, blokady: ['/api/blok'] })
  const t = Date.now()
  const x = new okno.XMLHttpRequest()
  x.open('GET', '/api/a')
  x.send()
  const przerwany = new okno.XMLHttpRequest()
  przerwany.open('GET', '/api/b')
  przerwany.send()
  przerwany.abort()
  const sync = new okno.XMLHttpRequest()
  sync.open('GET', '/api/sync', false)
  sync.send()
  assert.deepEqual(pobrania, ['abort /api/b', 'xhr /api/sync'], 'synchroniczny od razu, opóźniony jeszcze nie')
  const syncZly = new okno.XMLHttpRequest()
  syncZly.open('GET', '/api/blok', false)
  assert.throws(() => syncZly.send(), (b) => b instanceof DOMException && b.name === 'NetworkError')
  await new Promise((ok) => setTimeout(ok, 260))
  assert.deepEqual(pobrania, ['abort /api/b', 'xhr /api/sync', 'xhr /api/a'])
  assert.ok(Date.now() - t >= 190)
})

test('po recenzji: * w środku wzorca, znaki specjalne dosłownie, wzorzec z samych spacji nic nie blokuje; drugie uruchomienie skryptu nie dubluje opóźnienia', async () => {
  const { okno, pobrania } = piaskownica({ opoznienieMs: 0, blokady: ['/api/*/glosy', '/a?b=1', '   '] })
  await assert.rejects(okno.fetch('/api/7/glosy'), TypeError)
  assert.equal(await okno.fetch('/ab=1'), 'odpowiedz', '? to znak, nie kwantyfikator')
  await assert.rejects(okno.fetch('/a?b=1'), TypeError)
  assert.equal(await okno.fetch('/zwykly'), 'odpowiedz')
  assert.deepEqual(pobrania, ['/ab=1', '/zwykly'])
  const druga = piaskownica({ opoznienieMs: 150, blokady: [] })
  runInContext(SKRYPT, druga.okno)
  const t = Date.now()
  await druga.okno.fetch('/a')
  assert.ok(Date.now() - t < 280, `jedno opóźnienie, było ${Date.now() - t} ms`)
})

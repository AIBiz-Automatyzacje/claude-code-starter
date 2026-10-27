// Serwer narzedzia makiet (P24 IU-5) na prawdziwym node:http: punkty fixture'u etapu 4 w katalogu tymczasowym, decyzje z tokenem
// i bez, konflikt 409, zgloszenie do kolejki, SSE `punkty` i `przeladuj`, statyka bez wyjscia poza katalog, proxy poza prefiksem.

import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

import { czekaj } from '../kolejka.mjs'
import { celLokalny } from '../proxy.mjs'
import { punktyWizualne } from '../punkty.mjs'
import { NAGLOWEK_TOKENU, utworzSerwer } from '../serwer.mjs'
import { skrotSha1 } from '../zapis-linii.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const ZADANIE = 'etap-4-dodawanie-i-moderacja'
const SMOKE = `docs/operator/2026-10-18-${ZADANIE}-smoke.md`
const PLAN = 'docs/plans/2026-10-17-001-feat-etap-4-plan.md'
const TOKEN = 'a'.repeat(32)
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

/** @typedef {{ port: number, projekt: string, stan: string, plik: string, cel: string[], przeladuj: () => void }} Kontekst */

/** @param {import('node:http').Server} s @returns {Promise<number>} */
const nasluch = (s) => new Promise((ok) => s.listen(0, '127.0.0.1', () => ok(/** @type {import('node:net').AddressInfo} */ (s.address()).port)))

/** @param {(k: Kontekst) => Promise<void>} cialo @param {{ zgloszenia?: 'na-koniec' | 'od-razu' }} [opcje] domyslnie od razu (testy P24) */
async function zSerwerem(cialo, { zgloszenia = 'od-razu' } = {}) {
  const projekt = mkdtempSync(join(tmpdir(), 'makieta-serwer-'))
  const strona = join(projekt, 'strona-narzedzia')
  const pliki = {
    [`docs/completed/${ZADANIE}/${ZADANIE}-plan.md`]: `Plan techniczny: \`${PLAN}\`\n`,
    [PLAN]: '---\nfigma_screens:\n  wyslano-telefon: ./docs/plans/f/wyslano-telefon.png\n  publikuj-telefon-wysylanie: ./docs/plans/f/p.png\n---\n',
    'docs/plans/f/wyslano-telefon.png': 'png-figma',
    'strona-narzedzia/index.html': '<!doctype html><title>Makieta</title>',
    'strona-narzedzia/styl.css': 'body{}',
    'tajne.txt': 'sekret',
  }
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(join(projekt, p, '..'), { recursive: true })
    writeFileSync(join(projekt, p), t)
  }
  mkdirSync(join(projekt, 'docs/operator'), { recursive: true })
  copyFileSync(join(KATALOG, 'fixtures', 'vibersi-etap-4-smoke.md'), join(projekt, SMOKE))
  mkdirSync(join(projekt, `docs/completed/${ZADANIE}/visual-diff`), { recursive: true })
  writeFileSync(join(projekt, `docs/completed/${ZADANIE}/visual-diff/moje-projekty-telefon-figma.png`), PNG)
  /** @type {string[]} */
  const cel = []
  const aplikacja = createServer((req, res) => { cel.push(`${req.method} ${req.url}`); res.end('aplikacja') })
  const portAplikacji = await nasluch(aplikacja)
  const stan = join(projekt, 'stan')
  const s = utworzSerwer({ projekt, smoke: SMOKE, aplikacja: celLokalny(`http://localhost:${portAplikacji}`), token: TOKEN, katalogStanu: stan, katalogStrony: strona, zgloszenia })
  const port = await nasluch(s.serwer)
  try {
    await cialo({ port, projekt, stan, plik: join(projekt, SMOKE), cel, przeladuj: s.przeladuj })
  } finally {
    await s.zamknij()
    aplikacja.closeAllConnections()
    await new Promise((ok) => aplikacja.close(ok))
    rmSync(projekt, { recursive: true, force: true })
  }
}

/** @param {string} tekst @returns {any} cialo odpowiedzi API (koperta { data, error }) albo null dla tresci spoza JSON */
function jakoJson(tekst) {
  try {
    return JSON.parse(tekst)
  } catch {
    // Strona HTML, PNG albo zerwane polaczenie — test sprawdza wtedy status i tekst.
    return null
  }
}

/**
 * @param {number} port
 * @param {{ method?: string, path?: string, headers?: Record<string, string>, body?: unknown }} [o]
 * @returns {Promise<{ status: number, headers: import('node:http').IncomingHttpHeaders, tekst: string, json: any }>}
 */
function zapytaj(port, { method = 'GET', path = '/__makieta/', headers = {}, body } = {}) {
  return new Promise((ok, nie) => {
    const r = request({ host: '127.0.0.1', port, method, path, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers } }, (odp) => {
      /** @type {Buffer[]} */
      const czesci = []
      odp.on('data', (c) => czesci.push(c))
      odp.on('end', () => {
        const tekst = Buffer.concat(czesci).toString()
        ok({ status: odp.statusCode ?? 0, headers: odp.headers, tekst, json: jakoJson(tekst) })
      })
    })
    r.on('error', nie)
    r.end(body === undefined ? undefined : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
  })
}

const zTokenem = { [NAGLOWEK_TOKENU]: TOKEN }

/** @param {string} plik @param {number} nr linia 1-based */
const punktLinii = (plik, nr) => {
  const p = punktyWizualne(readFileSync(plik, 'utf8'), skrotSha1).find((x) => x.linia === nr)
  assert.ok(p)
  return p
}

/**
 * Odbiera zdarzenia SSE do pierwszego o nazwie `nazwa`.
 * @param {number} port @param {string} nazwa @param {() => void} poPolaczeniu
 * @returns {Promise<string>}
 */
function czekajNaZdarzenie(port, nazwa, poPolaczeniu) {
  return new Promise((ok, nie) => {
    const r = request({ host: '127.0.0.1', port, path: `/__makieta/api/zdarzenia?t=${TOKEN}` }, (odp) => {
      let bufor = ''
      odp.on('data', (c) => {
        bufor += c.toString()
        if (bufor.includes(': start')) { bufor = bufor.replace(': start\n\n', ''); poPolaczeniu() }
        if (bufor.includes(`event: ${nazwa}\n`)) { r.destroy(); ok(nazwa) }
      })
    })
    r.on('error', (b) => (b.message.includes('socket hang up') ? undefined : nie(b)))
    r.end()
  })
}

test('GET api/punkty na fixture etapu 4: punkty ze statusami, ekrany z URL makiety, ekrany SPEC bez punktu; bez tokenu 403', () => zSerwerem(async ({ port }) => {
  const bez = await zapytaj(port, { path: '/__makieta/api/punkty' })
  assert.equal(bez.status, 403)
  assert.equal(bez.json.error.code, 'token')
  const w = await zapytaj(port, { path: '/__makieta/api/punkty', headers: zTokenem })
  assert.equal(w.status, 200)
  assert.equal(w.json.error, null)
  assert.equal(w.json.data.punkty.length, 24)
  assert.deepEqual(new Set(w.json.data.punkty.map((/** @type {{ status: string }} */ p) => p.status)), new Set(['zgodny', 'odstepstwo']))
  assert.deepEqual(w.json.data.pominiete, ['publikuj-telefon-wysylanie'])
  const moje = w.json.data.ekrany.find((/** @type {{ ekran: string }} */ e) => e.ekran === 'moje-projekty-telefon')
  assert.equal(moje.url, '/__makieta/makieta/moje-projekty-telefon.png')
  assert.equal(w.json.data.ekrany.find((/** @type {{ ekran: string }} */ e) => e.ekran === 'admin-stany').url, null)
  assert.equal(w.headers['referrer-policy'], 'no-referrer')
}))

test('decyzja „zgodne” z tokenem zmienia linię; bez tokenu, z obcym Origin albo „poprawione” ze strony — 4xx i plik bez zmian', () => zSerwerem(async ({ port, plik }) => {
  const przed = readFileSync(plik, 'utf8')
  const p = punktLinii(plik, 51)
  const cialo = { punkt: p.id, linia: p.tekst, decyzja: 'zgodne' }
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', body: cialo })).status, 403)
  assert.equal((await zapytaj(port, { method: 'POST', path: `/__makieta/api/decyzja?t=${TOKEN}`, body: cialo })).status, 403, 'token w query tylko dla SSE')
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', body: cialo, headers: { ...zTokenem, origin: 'http://evil.example' } })).status, 403)
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', body: { ...cialo, decyzja: 'poprawione' }, headers: zTokenem })).status, 400)
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', body: { ...cialo, nadmiar: 1 }, headers: zTokenem })).status, 400)
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', body: '{nie json', headers: zTokenem })).status, 400)
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', body: { ...cialo, notatka: 'x'.repeat(20_000) }, headers: zTokenem })).status, 413)
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', body: { ...cialo, decyzja: 'odstepstwo' }, headers: zTokenem })).status, 400, 'odstępstwo bez notatki')
  assert.equal(readFileSync(plik, 'utf8'), przed)
  const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', body: cialo, headers: { ...zTokenem, origin: `http://127.0.0.1:${port}` } })
  assert.equal(w.status, 200, w.tekst)
  assert.match(w.json.data.linia, /^- \[x\] \*\(\d{4}-\d{2}-\d{2}: zgodne\)\* \*\(2026-10-18, druga sesja/)
  assert.equal(readFileSync(plik, 'utf8'), przed.replace(p.tekst, w.json.data.linia))
}))

test('decyzja na linii zmienionej w pliku po odczycie = 409 z bieżącą linią', () => zSerwerem(async ({ port, plik }) => {
  const p = punktLinii(plik, 51)
  const zmieniona = p.tekst.replace('- [x] ', '- [x] *(2026-10-20: sesja)* ')
  writeFileSync(plik, readFileSync(plik, 'utf8').replace(p.tekst, zmieniona))
  const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', body: { punkt: p.id, linia: p.tekst, decyzja: 'zgodne' }, headers: zTokenem })
  assert.equal(w.status, 409)
  assert.deepEqual(w.json, { data: { powod: 'linia-zmieniona', linia: zmieniona }, error: { code: 'konflikt', message: 'Sesja zmieniła ten punkt w międzyczasie.' } })
}))

test('„błąd” zapisuje linię i wpis kolejki ze SPEC i PNG; czekaj oddaje go raz, ponowny start już nie', () => zSerwerem(async ({ port, plik, stan }) => {
  const p = punktLinii(plik, 51)
  const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem,
    body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'liczniki\nw jednej linii', urzadzenie: 'iphone-15', szerokosc: 393, ekran: 'moje-projekty-telefon' } })
  assert.equal(w.status, 200, w.tekst)
  assert.equal(punktLinii(plik, 51).status, 'blad')
  const zdarzenia = []
  for await (const z of czekaj({ katalogStanu: stan, limitMs: 100, odstepMs: 20 })) zdarzenia.push(z)
  assert.equal(zdarzenia.length, 2)
  assert.deepEqual({ ...zdarzenia[0], id: undefined, czas: undefined }, {
    zdarzenie: 'zgloszenie', id: undefined, czas: undefined, punkt: p.id, ekran: 'moje-projekty-telefon', trasa: '/konto/projekty',
    viewport: { szerokosc: 390, wysokosc: 782 }, urzadzenie: 'iphone-15', szerokosc: 393, opis: 'liczniki w jednej linii', spec: null,
    makieta: `docs/completed/${ZADANIE}/visual-diff/moje-projekty-telefon-figma.png`, zrzut: null,
  })
  const ponownie = []
  for await (const z of czekaj({ katalogStanu: stan, limitMs: 60, odstepMs: 20 })) ponownie.push(z)
  assert.deepEqual(ponownie, [{ zdarzenie: 'limit' }])
}))

test('zmiana pliku smoke\'u wysyła SSE punkty; POST api/przeladuj z tokenem wysyła przeladuj; SSE bez tokenu = 403', () => zSerwerem(async ({ port, plik }) => {
  assert.equal((await zapytaj(port, { path: '/__makieta/api/zdarzenia' })).status, 403)
  await czekajNaZdarzenie(port, 'punkty', () => writeFileSync(plik, `${readFileSync(plik, 'utf8')}\n- [ ] dopisane przez sesję\n`))
  await czekajNaZdarzenie(port, 'przeladuj', () => void zapytaj(port, { method: 'POST', path: '/__makieta/api/przeladuj', headers: zTokenem }))
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/api/przeladuj' })).status, 403)
}))

test('statyka: strona i styl z katalogu strony; ../ i PNG spoza listy ekranów = 404; PNG z listy = bajty', () => zSerwerem(async ({ port, cel }) => {
  const strona = await zapytaj(port)
  assert.equal(strona.status, 200)
  assert.match(String(strona.headers['content-type']), /text\/html/)
  assert.match(String(strona.headers['content-security-policy']), /frame-ancestors 'none'/)
  assert.equal((await zapytaj(port, { path: '/__makieta/strona/styl.css' })).tekst, 'body{}')
  for (const zla of ['/__makieta/strona/../../serwer.mjs', '/__makieta/strona/..%2f..%2ftajne.txt', '/__makieta/strona/../tajne.txt', '/__makieta/wspolne/serwer.mjs', '/__makieta/strona/styl.css/x', '/__makieta/makieta/admin-stany.png', '/__makieta/makieta/..%2f..%2ftajne.png']) {
    const w = await zapytaj(port, { path: zla })
    assert.equal(w.status, 404, zla)
    assert.ok(!w.tekst.includes('sekret'))
  }
  const png = await new Promise((ok) => request({ host: '127.0.0.1', port, path: '/__makieta/makieta/moje-projekty-telefon.png' }, (odp) => {
    /** @type {Buffer[]} */
    const c = []
    odp.on('data', (x) => c.push(x))
    odp.on('end', () => ok([odp.headers['content-type'], Buffer.concat(c)]))
  }).end())
  assert.deepEqual(png, ['image/png', PNG])
  const wspolny = await zapytaj(port, { path: '/__makieta/urzadzenia.mjs' })
  assert.deepEqual([wspolny.status, wspolny.headers['content-type']], [200, 'text/javascript; charset=utf-8'], 'moduł wspólny ze stroną')
  assert.match(wspolny.tekst, /export const PRESETY/)
  for (const zly of ['/__makieta/serwer.mjs', '/__makieta/punkty.mjs', '/__makieta/strona/urzadzenia.mjs']) assert.equal((await zapytaj(port, { path: zly })).status, 404, zly)
  assert.deepEqual(cel, [])
}))

test('ścieżka spoza prefiksu trafia do proxy; Host inny niż 127.0.0.1:<port> = 421 i nic nie idzie do aplikacji', () => zSerwerem(async ({ port, cel }) => {
  const w = await zapytaj(port, { path: '/konto/projekty?x=1' })
  assert.equal(w.tekst, 'aplikacja')
  assert.deepEqual(cel, ['GET /konto/projekty?x=1'])
  const obcy = await zapytaj(port, { path: '/konto', headers: { host: `localhost:${port}` } })
  assert.equal(obcy.status, 421)
  assert.equal((await zapytaj(port, { path: '/__makieta/api/punkty', headers: { ...zTokenem, host: `evil.example:${port}` } })).status, 421)
  assert.deepEqual(cel, ['GET /konto/projekty?x=1'])
}))

test('upgrade z obcym Host albo pod prefiksem narzędzia = gniazdo zamknięte, aplikacja nic nie dostaje', () => zSerwerem(async ({ port, cel }) => {
  for (const [host, sciezka] of [[`evil.example:${port}`, '/@vite/hmr'], [`127.0.0.1:${port}`, '/__makieta/api/zdarzenia']]) {
    const wynik = await new Promise((ok) => {
      const r = request({ host: '127.0.0.1', port, path: sciezka, headers: { host, connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-key': 'a2V5', 'sec-websocket-version': '13' } })
      r.on('upgrade', () => ok('upgrade'))
      r.on('response', (o) => ok(`odpowiedź ${o.statusCode}`))
      r.on('error', (b) => ok(b.message))
      r.end()
    })
    assert.equal(wynik, 'socket hang up', `${host} ${sciezka}`)
  }
  assert.deepEqual(cel, [])
}))

test('po recenzji: „błąd” z drugiego ekranu punktu niesie jego ekran i PNG; ekran spoza punktu = 400; urządzenie w jednej linii', () => zSerwerem(async ({ port, plik, projekt, stan }) => {
  writeFileSync(join(projekt, `docs/completed/${ZADANIE}/visual-diff/admin-kolejka-telefon-figma.png`), PNG)
  const p = punktLinii(plik, 95)
  assert.deepEqual(p.ekrany, ['admin-skrzynka-komputer', 'admin-kolejka-telefon'])
  const obcy = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'x', urzadzenie: 'u', szerokosc: 390, ekran: 'admin-stany' } })
  assert.deepEqual([obcy.status, obcy.json.error.code], [400, 'zle-cialo'])
  const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'karta', urzadzenie: 'iphone\n15', szerokosc: 393, ekran: 'admin-kolejka-telefon' } })
  assert.equal(w.status, 200, w.tekst)
  const wpisy = readFileSync(join(stan, 'kolejka.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  assert.deepEqual(wpisy.map((x) => [x.ekran, x.makieta, x.urzadzenie]), [['admin-kolejka-telefon', `docs/completed/${ZADANIE}/visual-diff/admin-kolejka-telefon-figma.png`, 'iphone 15']])
}))

test('po recenzji: kolejka niezapisywalna — linia zapisana, odpowiedź 200 z ostrzeżeniem; „poprawione” ze strony = zle-cialo', () => zSerwerem(async ({ port, plik, stan }) => {
  mkdirSync(join(stan, 'kolejka.jsonl'), { recursive: true })
  const p = punktLinii(plik, 51)
  const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'x', urzadzenie: 'u', szerokosc: 390 } })
  assert.equal(w.status, 200, w.tekst)
  assert.match(w.json.data.ostrzezenie, /zgłoszenia/)
  assert.equal(punktLinii(plik, 51).status, 'blad')
  const q = punktLinii(plik, 52)
  const popr = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: { punkt: q.id, linia: q.tekst, decyzja: 'poprawione' } })
  assert.deepEqual([popr.status, popr.json.error.code], [400, 'zle-cialo'])
}))

test('po recenzji: SSE punkty zaraz po decyzji; api/punkty bez surowych adnotacji; POST na statykę 405; plik spoza białej listy i złe kodowanie = 404', () => zSerwerem(async ({ port, plik, projekt }) => {
  const p = punktLinii(plik, 51)
  const start = Date.now()
  await czekajNaZdarzenie(port, 'punkty', () => void zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: { punkt: p.id, linia: p.tekst, decyzja: 'zgodne' } }))
  assert.ok(Date.now() - start < 2000)
  const punkty = await zapytaj(port, { path: '/__makieta/api/punkty', headers: zTokenem })
  assert.equal('adnotacje' in punkty.json.data.punkty[0], false)
  assert.equal('checkbox' in punkty.json.data.punkty[0], false)
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/strona/styl.css' })).status, 405)
  writeFileSync(join(projekt, 'strona-narzedzia/.env'), 'SEKRET=1')
  assert.equal((await zapytaj(port, { path: '/__makieta/strona/.env' })).status, 404)
  const zle = await zapytaj(port, { path: '/__makieta/makieta/%E0%A4%A.png' })
  assert.equal(zle.status, 404)
}))

test('po recenzji: zamknij() kończy się mimo otwartego WebSocketu przez proxy; token krótszy niż 16 znaków = błąd', async () => {
  const aplikacja = createServer()
  aplikacja.on('upgrade', (_req, socket) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n')
    socket.on('end', () => socket.destroy())
  })
  const portAplikacji = await nasluch(aplikacja)
  const projekt = mkdtempSync(join(tmpdir(), 'makieta-serwer-ws-'))
  writeFileSync(join(projekt, 'smoke.md'), '# pusty\n')
  const opcje = { projekt, smoke: 'smoke.md', aplikacja: celLokalny(`http://127.0.0.1:${portAplikacji}`), katalogStanu: join(projekt, 'stan') }
  assert.throws(() => utworzSerwer({ ...opcje, token: '' }), /token/)
  const s = utworzSerwer({ ...opcje, token: TOKEN })
  const port = await nasluch(s.serwer)
  try {
    await new Promise((ok, nie) => {
      const r = request({ host: '127.0.0.1', port, path: '/@vite/hmr', headers: { connection: 'Upgrade', upgrade: 'websocket' } })
      r.on('upgrade', () => ok(undefined))
      r.on('error', nie)
      r.end()
    })
    const start = Date.now()
    await s.zamknij()
    assert.ok(Date.now() - start < 1000, `zamknij trwało ${Date.now() - start} ms`)
  } finally {
    aplikacja.closeAllConnections()
    await new Promise((ok) => aplikacja.close(ok))
    rmSync(projekt, { recursive: true, force: true })
  }
})

test('P28 (4) tryb na koniec: „błąd” zapisuje linię bez wpisu kolejki; „Zakończ przegląd” oddaje sesji wszystkie zgłoszenia naraz z podsumowaniem', () => zSerwerem(async ({ port, plik, stan }) => {
  const punkty = await zapytaj(port, { path: '/__makieta/api/punkty', headers: zTokenem })
  assert.equal(punkty.json.data.zgloszenia, 'na-koniec')
  for (const [nr, opis] of [[51, 'liczniki'], [52, 'odstęp']]) {
    const p = punktLinii(plik, Number(nr))
    const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: opis, urzadzenie: 'iphone-15', szerokosc: 393 } })
    assert.equal(w.status, 200, w.tekst)
    assert.equal(punktLinii(plik, Number(nr)).status, 'blad')
  }
  assert.deepEqual(await (async () => { const z = []; for await (const x of czekaj({ katalogStanu: stan, limitMs: 60, odstepMs: 20 })) z.push(x); return z })(), [{ zdarzenie: 'limit' }], 'przed końcem przeglądu sesja nic nie dostaje')
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/api/zakoncz' })).status, 403)
  const koniec = await zapytaj(port, { method: 'POST', path: '/__makieta/api/zakoncz', headers: zTokenem })
  assert.equal(koniec.status, 200, koniec.tekst)
  assert.equal(koniec.json.data.zgloszenia, 2)
  const zdarzenia = []
  for await (const z of czekaj({ katalogStanu: stan, limitMs: 100, odstepMs: 20 })) zdarzenia.push(z)
  assert.deepEqual(zdarzenia.map((z) => z.zdarzenie), ['przeglad-zakonczony', 'limit'])
  const [przeglad] = zdarzenia
  assert.ok(przeglad.zdarzenie === 'przeglad-zakonczony')
  assert.deepEqual(przeglad.zgloszenia.map((z) => [z.linia, (z.zgloszenie ?? '').replace(/^\d{4}-\d{2}-\d{2}: /, '')]), [[51, 'błąd zgłoszony — iphone-15 393 px: liczniki'], [52, 'błąd zgłoszony — iphone-15 393 px: odstęp']])
  assert.equal(przeglad.zgloszenia[0].ekrany[0].ekran, 'moje-projekty-telefon')
  assert.equal(przeglad.podsumowanie.blad, 2)
  assert.equal(przeglad.podsumowanie.punkty, 24)
  assert.equal(przeglad.smoke, SMOKE)
}, { zgloszenia: 'na-koniec' }))

test('P28 (4) tryb od razu: api/zakoncz = 409 (zgłoszenia poszły już do sesji), api/punkty podaje tryb', () => zSerwerem(async ({ port }) => {
  assert.equal((await zapytaj(port, { path: '/__makieta/api/punkty', headers: zTokenem })).json.data.zgloszenia, 'od-razu')
  const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/zakoncz', headers: zTokenem })
  assert.deepEqual([w.status, w.json.error.code], [409, 'tryb'])
}))

test('P28 (4) domyślny tryb serwera to „na koniec”', async () => {
  const projekt = mkdtempSync(join(tmpdir(), 'makieta-tryb-'))
  try {
    mkdirSync(join(projekt, 'docs/operator'), { recursive: true })
    copyFileSync(join(KATALOG, 'fixtures', 'vibersi-etap-4-smoke.md'), join(projekt, SMOKE))
    mkdirSync(join(projekt, `docs/completed/${ZADANIE}`), { recursive: true })
    writeFileSync(join(projekt, `docs/completed/${ZADANIE}/${ZADANIE}-plan.md`), 'x\n')
    const s = utworzSerwer({ projekt, smoke: SMOKE, aplikacja: celLokalny('http://localhost:5999'), token: TOKEN, katalogStanu: join(projekt, 'stan') })
    const port = await nasluch(s.serwer)
    try {
      assert.equal((await zapytaj(port, { path: '/__makieta/api/punkty', headers: zTokenem })).json.data.zgloszenia, 'na-koniec')
    } finally {
      await s.zamknij()
    }
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
})

test('po recenzji P28: kolejka niezapisywalna przy końcu przeglądu = 503 z drogą awaryjną („zgłoszenia” w sesji)', () => zSerwerem(async ({ port, stan }) => {
  mkdirSync(join(stan, 'kolejka.jsonl'), { recursive: true })
  const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/zakoncz', headers: zTokenem })
  assert.deepEqual([w.status, w.json.error.code], [503, 'kolejka'])
  assert.match(w.json.error.message, /napisz w sesji „zgłoszenia”/)
}, { zgloszenia: 'na-koniec' }))

const SYGNATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ZRZUT = Buffer.concat([SYGNATURA_PNG, Buffer.from('zrzut operatora')])
const KATALOG_ZRZUTOW = `docs/completed/${ZADANIE}/visual-diff/zgloszenia`

/** @param {number} port @param {string} punkt @param {Buffer} cialo @param {Record<string, string>} [naglowki] */
const wyslijZrzut = (port, punkt, cialo, naglowki = {}) => zapytaj(port, { method: 'POST', path: `/__makieta/api/zrzut?punkt=${punkt}`, headers: { ...zTokenem, 'content-type': 'image/png', ...naglowki }, body: cialo })

test('P27 S3 poz. 27: POST api/zrzut zapisuje PNG w visual-diff/zgloszenia/<punkt>-<n>.png katalogu zadania; inny typ 415, nie-PNG 415, ponad 5 MB 413, zły punkt 400/404', () => zSerwerem(async ({ port, plik, projekt }) => {
  const p = punktLinii(plik, 51)
  const pierwszy = await wyslijZrzut(port, p.id, ZRZUT)
  assert.equal(pierwszy.status, 200, pierwszy.tekst)
  assert.equal(pierwszy.json.data.zrzut, `${KATALOG_ZRZUTOW}/${p.id}-1.png`)
  assert.deepEqual(readFileSync(join(projekt, pierwszy.json.data.zrzut)), ZRZUT)
  assert.equal((await wyslijZrzut(port, p.id, ZRZUT)).json.data.zrzut, `${KATALOG_ZRZUTOW}/${p.id}-2.png`)
  assert.equal((await wyslijZrzut(port, p.id, ZRZUT, { 'content-type': 'image/jpeg' })).status, 415)
  assert.equal((await wyslijZrzut(port, p.id, Buffer.from('<svg/>'))).status, 415, 'treść bez sygnatury PNG')
  const zaDuzy = await wyslijZrzut(port, p.id, Buffer.concat([SYGNATURA_PNG, Buffer.alloc(5 * 1024 * 1024)]))
  assert.equal(zaDuzy.status, 413)
  assert.equal((await wyslijZrzut(port, 'p-zle', ZRZUT)).status, 400)
  assert.equal((await wyslijZrzut(port, 'p-00000000', ZRZUT)).status, 404)
  assert.equal((await zapytaj(port, { method: 'POST', path: `/__makieta/api/zrzut?punkt=${p.id}`, headers: { 'content-type': 'image/png' }, body: ZRZUT })).status, 403)
  assert.deepEqual(readdirSync(join(projekt, KATALOG_ZRZUTOW)).sort(), [`${p.id}-1.png`, `${p.id}-2.png`])
}))

test('P27 S3 poz. 27: „błąd” ze zrzutem — ścieżka w adnotacji linii, w zgłoszeniu kolejki (od razu) i w przeglądzie (na koniec); zrzut spoza katalogu, innego punktu albo nieistniejący = 400', () => zSerwerem(async ({ port, plik, stan }) => {
  const p = punktLinii(plik, 51)
  const zrzut = (await wyslijZrzut(port, p.id, ZRZUT)).json.data.zrzut
  const inny = punktLinii(plik, 52)
  for (const zly of [`${KATALOG_ZRZUTOW}/${p.id}-9.png`, `${KATALOG_ZRZUTOW}/${inny.id}-1.png`, 'tajne.txt', `${KATALOG_ZRZUTOW}/../../${ZADANIE}-plan.md`]) {
    const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'x', urzadzenie: 'iphone-15', szerokosc: 393, zrzut: zly } })
    assert.equal(w.status, 400, zly)
  }
  const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'liczniki', urzadzenie: 'iphone-15', szerokosc: 393, zrzut } })
  assert.equal(w.status, 200, w.tekst)
  assert.match(punktLinii(plik, 51).adnotacje[0], new RegExp(`: błąd zgłoszony — iphone-15 393 px: liczniki · zrzut: ${zrzut.replace(/[.]/g, '\\.')}$`))
  const z = []
  for await (const x of czekaj({ katalogStanu: stan, limitMs: 60, odstepMs: 20 })) z.push(x)
  assert.equal(z[0].zdarzenie, 'zgloszenie')
  assert.equal(z[0].zrzut, zrzut)
}))

test('P27 S3 poz. 27: przegląd na koniec niesie pole zrzut każdego zgłoszenia (null bez zrzutu)', () => zSerwerem(async ({ port, plik, stan }) => {
  const [a, b] = [punktLinii(plik, 51), punktLinii(plik, 52)]
  const zrzut = (await wyslijZrzut(port, a.id, ZRZUT)).json.data.zrzut
  for (const [p, extra] of [[a, { zrzut }], [b, {}]]) {
    const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'x', urzadzenie: 'iphone-15', szerokosc: 393, ...extra } })
    assert.equal(w.status, 200, w.tekst)
  }
  assert.equal((await zapytaj(port, { method: 'POST', path: '/__makieta/api/zakoncz', headers: zTokenem })).status, 200)
  const z = []
  for await (const x of czekaj({ katalogStanu: stan, limitMs: 60, odstepMs: 20 })) z.push(x)
  assert.ok(z[0].zdarzenie === 'przeglad-zakonczony')
  assert.deepEqual(z[0].zgloszenia.map((/** @type {{ linia: number, zrzut: string | null }} */ x) => [x.linia, x.zrzut]), [[51, zrzut], [52, null]])
}, { zgloszenia: 'na-koniec' }))

test('po recenzji P27 S3 (P2): zrzut tylko z katalogu zrzutów zadania — `../` za prefiksem i katalog o tej samej długości z istniejącym plikiem = 400; zrzut nie-tekstem = 400', () => zSerwerem(async ({ port, plik, projekt }) => {
  const p = punktLinii(plik, 51)
  await wyslijZrzut(port, p.id, ZRZUT)
  const podrzucone = [`${KATALOG_ZRZUTOW}/../../x/${p.id}-1.png`, `${KATALOG_ZRZUTOW.replace('zgloszenia', 'zgloszeniA')}/${p.id}-1.png`]
  for (const sciezka of podrzucone) {
    mkdirSync(join(projekt, sciezka, '..'), { recursive: true })
    writeFileSync(join(projekt, sciezka), ZRZUT)
  }
  for (const zrzut of [...podrzucone, 5]) {
    const w = await zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: { punkt: p.id, linia: p.tekst, decyzja: 'blad', notatka: 'x', urzadzenie: 'iphone-15', szerokosc: 393, zrzut } })
    assert.equal(w.status, 400, String(zrzut))
  }
  assert.equal(punktLinii(plik, 51).tekst, p.tekst, 'linia bez zmian')
}))

test('po recenzji P27 S3 (P2): typ zrzutu bez względu na wielkość liter i parametry; ciało ponad limit + 1 MB zrywa połączenie (JSON i zrzut)', () => zSerwerem(async ({ port, plik }) => {
  const p = punktLinii(plik, 51)
  assert.equal((await wyslijZrzut(port, p.id, ZRZUT, { 'content-type': 'IMAGE/PNG; x=1' })).status, 200)
  await assert.rejects(zapytaj(port, { method: 'POST', path: '/__makieta/api/decyzja', headers: zTokenem, body: 'x'.repeat(16 * 1024 + 1024 * 1024 + 64 * 1024) }))
  await assert.rejects(wyslijZrzut(port, p.id, Buffer.concat([SYGNATURA_PNG, Buffer.alloc(6 * 1024 * 1024 + 64 * 1024)])))
  assert.equal((await zapytaj(port, { path: '/__makieta/api/punkty', headers: zTokenem })).status, 200, 'serwer dalej odpowiada')
}))

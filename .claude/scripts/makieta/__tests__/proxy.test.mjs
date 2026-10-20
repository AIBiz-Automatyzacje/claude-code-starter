// Proxy narzedzia (P24 IU-4) na prawdziwych serwerach node:http: cel testowy na losowym porcie, proxy na drugim. POST z cialem,
// gzip bajtowo, SSE bez buforowania, WebSocket przez `upgrade`, 502 przy wylaczonym celu, cel tylko lokalny, prefiks narzedzia.

import { createHash } from 'node:crypto'
import { createServer, request } from 'node:http'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'

import { BladProxy, PREFIKS_NARZEDZIA, celLokalny, utworzProxy } from '../proxy.mjs'

/** @typedef {import('node:http').Server} Serwer */

/** @param {Serwer} s @returns {Promise<number>} */
const nasluch = (s) => new Promise((ok) => s.listen(0, '127.0.0.1', () => ok(/** @type {import('node:net').AddressInfo} */ (s.address()).port)))
/** @param {Serwer} s @returns {Promise<void>} */
const zamknij = (s) => new Promise((ok) => { s.closeAllConnections(); s.close(() => ok()) })

/**
 * @param {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} obsluga
 * @param {(cel: { port: number, wywolania: string[] }, proxy: { port: number, logi: string[] }) => Promise<void>} cialo
 * @param {{ bezCelu?: boolean, upgradeCelu?: (req: import('node:http').IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) => void }} [opcje]
 */
async function zSerwerami(obsluga, cialo, { bezCelu = false, upgradeCelu } = {}) {
  /** @type {string[]} */
  const wywolania = []
  const cel = createServer((req, res) => { wywolania.push(`${req.method} ${req.url}`); obsluga(req, res) })
  if (upgradeCelu) cel.on('upgrade', upgradeCelu)
  const portCelu = await nasluch(cel)
  if (bezCelu) await zamknij(cel)
  /** @type {string[]} */
  const logi = []
  const proxy = utworzProxy({ cel: celLokalny(`http://localhost:${portCelu}`), log: (l) => logi.push(l) })
  const serwerProxy = createServer(proxy.obsluzZadanie)
  serwerProxy.on('upgrade', proxy.obsluzUpgrade)
  const portProxy = await nasluch(serwerProxy)
  try {
    await cialo({ port: portCelu, wywolania }, { port: portProxy, logi })
  } finally {
    await zamknij(serwerProxy)
    if (!bezCelu) await zamknij(cel)
  }
}

/**
 * @param {number} port
 * @param {{ method?: string, path?: string, headers?: Record<string, string>, body?: string }} [o]
 * @returns {Promise<{ status: number, headers: import('node:http').IncomingHttpHeaders, body: Buffer }>}
 */
function zapytaj(port, { method = 'GET', path = '/', headers = {}, body } = {}) {
  return new Promise((ok, nie) => {
    const r = request({ host: '127.0.0.1', port, method, path, headers }, (odp) => {
      /** @type {Buffer[]} */
      const czesci = []
      odp.on('data', (c) => czesci.push(c))
      odp.on('end', () => ok({ status: odp.statusCode ?? 0, headers: odp.headers, body: Buffer.concat(czesci) }))
    })
    r.on('error', nie)
    r.end(body)
  })
}

test('POST z ciałem dochodzi do celu z Host proxy; nagłówki ochronne zdjęte; log bez query', () => zSerwerami((req, res) => {
  /** @type {Buffer[]} */
  const czesci = []
  req.on('data', (c) => czesci.push(c))
  req.on('end', () => {
    res.writeHead(201, { 'content-type': 'application/json', 'x-frame-options': 'DENY', 'content-security-policy': "frame-ancestors 'none'; default-src 'self'", location: `http://localhost:${req.socket.localPort}/po` })
    res.end(JSON.stringify({ host: req.headers.host, fwd: req.headers['x-forwarded-host'], cialo: Buffer.concat(czesci).toString() }))
  })
}, async (cel, proxy) => {
  const w = await zapytaj(proxy.port, { method: 'POST', path: '/api/projekty?token=tajne', headers: { 'content-type': 'application/json' }, body: '{"a":1}' })
  assert.equal(w.status, 201)
  assert.deepEqual(JSON.parse(w.body.toString()), { host: `127.0.0.1:${proxy.port}`, fwd: `127.0.0.1:${proxy.port}`, cialo: '{"a":1}' })
  assert.equal(w.headers['x-frame-options'], undefined)
  assert.equal(w.headers['content-security-policy'], "default-src 'self'")
  assert.equal(w.headers.location, `http://127.0.0.1:${proxy.port}/po`)
  assert.deepEqual(cel.wywolania, ['POST /api/projekty?token=tajne'])
  assert.deepEqual(proxy.logi, ['POST /api/projekty 201'])
}))

test('odpowiedź gzip przechodzi bajtowo bez zmian, z content-encoding', () => {
  const spakowane = gzipSync(Buffer.from('<p>zażółć</p>'.repeat(50)))
  return zSerwerami((_req, res) => {
    res.writeHead(200, { 'content-encoding': 'gzip', 'content-type': 'text/html' })
    res.end(spakowane)
  }, async (_cel, proxy) => {
    const w = await zapytaj(proxy.port, { headers: { 'accept-encoding': 'gzip' } })
    assert.equal(w.headers['content-encoding'], 'gzip')
    assert.deepEqual(w.body, spakowane)
  })
})

test('SSE przechodzi bez buforowania — pierwsze zdarzenie przed końcem odpowiedzi', () => zSerwerami((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  res.write('data: pierwsze\n\n')
}, (_cel, proxy) => new Promise((ok, nie) => {
  const r = request({ host: '127.0.0.1', port: proxy.port, path: '/zdarzenia' }, (odp) => {
    odp.once('data', (c) => {
      assert.equal(c.toString(), 'data: pierwsze\n\n')
      r.destroy()
      ok()
    })
  })
  r.on('error', (b) => (b.message.includes('socket hang up') ? ok() : nie(b)))
  r.end()
})))

test('WebSocket przez proxy wymienia wiadomość z celem (echo na upgrade); zamknięcie klienta zamyka połączenie z celem', () => {
  /** @type {Promise<void>} */
  let zamknietyUCelu = Promise.resolve()
  return zSerwerami(() => {}, (_cel, proxy) => new Promise((ok, nie) => {
    const klucz = Buffer.from('0123456789abcdef').toString('base64')
    const r = request({ host: '127.0.0.1', port: proxy.port, path: '/@vite/hmr', headers: { connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-key': klucz, 'sec-websocket-version': '13' } })
    r.on('upgrade', (odp, gniazdo, glowa) => {
      assert.equal(odp.statusCode, 101)
      assert.equal(odp.headers['sec-websocket-accept'], createHash('sha1').update(`${klucz}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64'))
      let odebrane = glowa.toString()
      gniazdo.on('data', (d) => {
        odebrane += d.toString()
        if (!odebrane.includes('echo:ping')) return
        assert.equal(odebrane, 'witaj|echo:ping', 'dane celu wysłane razem z 101 (bufor head) też dochodzą')
        gniazdo.end()
        const limit = setTimeout(() => nie(new Error('proxy zostawiło połączenie z celem otwarte')), 2000)
        zamknietyUCelu.then(() => { clearTimeout(limit); ok() }, nie)
      })
      gniazdo.write('ping')
    })
    r.on('error', nie)
    r.end()
  }), {
    upgradeCelu: (req, socket) => {
      zamknietyUCelu = new Promise((ok) => socket.on('end', () => {
        socket.destroy()
        ok()
      }))
      const akcept = createHash('sha1').update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${akcept}\r\n\r\nwitaj|`)
      socket.on('data', (d) => socket.write(`echo:${d}`))
    },
  })
})

test('cel wyłączony → 502 ze stroną komunikatu, proxy dalej odpowiada; cel spoza localhost = odmowa', async () => {
  await zSerwerami(() => {}, async (cel, proxy) => {
    for (let i = 0; i < 2; i++) {
      const w = await zapytaj(proxy.port, { path: '/konto' })
      assert.equal(w.status, 502)
      assert.match(String(w.headers['content-type']), /text\/html/)
      assert.match(w.body.toString(), new RegExp(`Aplikacja nie odpowiada pod http://localhost:${cel.port}`))
      assert.match(w.body.toString(), /Przeładuj ramki/)
    }
  }, { bezCelu: true })
  for (const zly of ['http://example.com', 'http://localhost.evil.pl:5173', 'http://10.0.0.5:5173', 'file:///etc/passwd', 'ftp://localhost', 'nie-adres']) {
    assert.throws(() => celLokalny(zly), (b) => b instanceof BladProxy && b.kod === 'cel-nielokalny', zly)
  }
  assert.equal(celLokalny('http://127.0.0.1:5173/').origin, 'http://127.0.0.1:5173')
  assert.equal(celLokalny('http://[::1]:5173').origin, 'http://[::1]:5173')
  assert.equal(celLokalny('http://LOCALHOST').origin, 'http://localhost')
})

test('cel na [::1]: proxy łączy się z adresem IPv6 bez nawiasów', async () => {
  const cel = createServer((_req, res) => res.end('ipv6'))
  await new Promise((ok) => cel.listen(0, '::1', () => ok(undefined)))
  const proxy = utworzProxy({ cel: celLokalny(`http://[::1]:${/** @type {import('node:net').AddressInfo} */ (cel.address()).port}`) })
  const serwer = createServer(proxy.obsluzZadanie)
  try {
    const w = await zapytaj(await nasluch(serwer))
    assert.equal(w.body.toString(), 'ipv6')
  } finally {
    await zamknij(serwer)
    await zamknij(cel)
  }
})

test('żądanie pod prefiksem narzędzia nie dociera do celu', () => zSerwerami((_req, res) => res.end('cel'), async (cel, proxy) => {
  assert.equal(PREFIKS_NARZEDZIA, '/__makieta/')
  const w = await zapytaj(proxy.port, { path: `${PREFIKS_NARZEDZIA}api/punkty` })
  assert.equal(w.status, 404)
  assert.deepEqual(cel.wywolania, [])
}))

// Proxy narzedzia (P24 IU-4) na prawdziwych serwerach node:http: cel testowy na losowym porcie, proxy na drugim. POST z cialem,
// gzip bajtowo, SSE bez buforowania, WebSocket przez `upgrade`, 502 przy wylaczonym celu, cel tylko lokalny, prefiks narzedzia.

import { createHash } from 'node:crypto'
import { createServer, request } from 'node:http'
import { connect } from 'node:net'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'

import { BladProxy, PREFIKS_NARZEDZIA, SKRYPT_SIECI, celLokalny, utworzProxy } from '../proxy.mjs'

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
  assert.equal(w.headers['x-frame-options'], 'SAMEORIGIN')
  assert.equal(w.headers['content-security-policy'], "default-src 'self'; frame-ancestors 'self'")
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

/** @param {number} port @param {string} surowe @returns {Promise<string>} surowa odpowiedz na surowe zadanie HTTP */
function surowo(port, surowe) {
  return new Promise((ok, nie) => {
    // write, nie end: pol-zamkniete polaczenie serwer http konczy bez odpowiedzi
    const g = connect(port, '127.0.0.1', () => g.write(surowe))
    let odp = ''
    g.on('data', (c) => { odp += c })
    g.on('end', () => ok(odp))
    g.on('error', nie)
  })
}

test('Host inny niż origin proxy = 421, adres w formie absolutnej = 400; cel nic nie dostaje', () => zSerwerami((_req, res) => res.end('cel'), async (cel, proxy) => {
  const w = await zapytaj(proxy.port, { path: '/src/main.tsx', headers: { host: `evil.example:${proxy.port}` } })
  assert.equal(w.status, 421)
  const absolutny = await surowo(proxy.port, `GET http://evil.example/x HTTP/1.1\r\nHost: 127.0.0.1:${proxy.port}\r\nConnection: close\r\n\r\n`)
  assert.match(absolutny, /^HTTP\/1\.1 400/)
  assert.deepEqual(cel.wywolania, [])
}))

test('przemyt: GET z ciałem chunked i Connection: content-length dochodzą do celu jako jedno żądanie z ciałem', () => zSerwerami((req, res) => {
  /** @type {Buffer[]} */
  const c = []
  req.on('data', (x) => c.push(x))
  req.on('end', () => res.end(`cialo:${Buffer.concat(c)}`))
}, async (cel, proxy) => {
  const przemyt = 'GET /przemycone HTTP/1.1\r\nHost: x\r\n\r\n'
  const hex = Buffer.byteLength(przemyt).toString(16)
  const a = await surowo(proxy.port, `GET /a HTTP/1.1\r\nHost: 127.0.0.1:${proxy.port}\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n${hex}\r\n${przemyt}\r\n0\r\n\r\n`)
  assert.match(a, /cialo:GET \/przemycone/)
  const b = await surowo(proxy.port, `DELETE /b HTTP/1.1\r\nHost: 127.0.0.1:${proxy.port}\r\nConnection: content-length, close\r\nContent-Length: 3\r\n\r\nabc`)
  assert.match(b, /cialo:abc/)
  await new Promise((ok) => setTimeout(ok, 100))
  assert.deepEqual(cel.wywolania, ['GET /a', 'DELETE /b'])
}))

test('odpowiedź z samymi nagłówkami (SSE bez danych) dochodzi od razu; zerwanie celu w trakcie = błąd u klienta; zamknięcie klienta kończy żądanie do celu', async () => {
  /** @type {(czy: boolean) => void} */
  let zamknietoUCelu = () => {}
  /** @type {Promise<boolean>} */
  const zamkniete = new Promise((ok) => { zamknietoUCelu = ok })
  await zSerwerami((req, res) => {
    if (req.url === '/sse') {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.flushHeaders()
      res.on('close', () => zamknietoUCelu(true))
    } else {
      res.writeHead(200, { 'content-type': 'text/plain', 'content-length': '100' })
      res.write('pół')
      setTimeout(() => res.socket?.destroy(), 20)
    }
  }, async (_cel, proxy) => {
    await new Promise((ok, nie) => {
      const r = request({ host: '127.0.0.1', port: proxy.port, path: '/sse' }, (odp) => {
        assert.equal(odp.statusCode, 200)
        r.destroy()
        ok(undefined)
      })
      r.on('error', (b) => (b.message.includes('socket hang up') ? undefined : nie(b)))
      r.end()
    })
    const limit = setTimeout(() => zamknietoUCelu(false), 3000)
    assert.equal(await zamkniete, true, 'cel nie zobaczył zamknięcia SSE po zamknięciu klienta')
    clearTimeout(limit)
    const blad = await new Promise((ok) => {
      const r = request({ host: '127.0.0.1', port: proxy.port, path: '/zerwane' }, (odp) => {
        odp.on('data', () => {})
        odp.on('aborted', () => ok('przerwane'))
        odp.on('error', (b) => ok(b.message))
        odp.on('end', () => ok('koniec'))
      })
      r.on('error', (b) => ok(b.message))
      r.end()
    })
    assert.notEqual(blad, 'koniec', 'klient nie może dostać „pełnej” odpowiedzi po zerwaniu celu')
  })
})

test('upgrade: dane klienta wysłane razem z uzgodnieniem dochodzą; odmowa celu wraca statusem; cel wyłączony = 502', async () => {
  await zSerwerami((_req, res) => { res.writeHead(403); res.end() }, async (_cel, proxy) => {
    const odmowa = await surowo(proxy.port, `GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${proxy.port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`)
    assert.match(odmowa, /^HTTP\/1\.1 403/)
  })
  await zSerwerami(() => {}, async (_cel, proxy) => {
    const brak = await surowo(proxy.port, `GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${proxy.port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`)
    assert.match(brak, /^HTTP\/1\.1 502/)
  }, { bezCelu: true })
  await zSerwerami(() => {}, (_cel, proxy) => new Promise((ok, nie) => {
    const g = connect(proxy.port, '127.0.0.1', () => g.write(`GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${proxy.port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\nwczesne`))
    let odp = ''
    g.on('data', (c) => {
      odp += c
      if (odp.includes('echo:wczesne')) { g.destroy(); ok(undefined) }
    })
    g.on('error', nie)
  }), {
    upgradeCelu: (_req, socket, glowa) => {
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n')
      if (glowa.length) socket.write(`echo:${glowa}`)
      socket.on('data', (d) => socket.write(`echo:${d}`))
      socket.on('end', () => socket.destroy())
    },
  })
})

// P28 (5): panel „Sieć” — proxy wstrzykuje skrypt narzedzia do stron HTML aplikacji (jedno miejsce, wszystkie ramki i karta).
test('P28 (5) strona HTML dostaje skrypt sieci zaraz po <head>, z nową długością; żądanie HTML idzie do celu bez kompresji', () => zSerwerami((req, res) => {
  const cialo = Buffer.from(`<!doctype html><html><HEAD lang="pl"><title>żółw</title></head>${req.headers['accept-encoding'] ?? 'brak'}`)
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': String(cialo.length) })
  res.end(cialo)
}, async (_cel, proxy) => {
  const w = await zapytaj(proxy.port, { path: '/p/x', headers: { accept: 'text/html,application/xhtml+xml', 'accept-encoding': 'gzip, br' } })
  const html = w.body.toString()
  assert.ok(html.startsWith(`<!doctype html><html><HEAD lang="pl">${SKRYPT_SIECI}<title>żółw</title>`), html)
  assert.equal(Number(w.headers['content-length']), w.body.length)
  assert.ok(html.endsWith('</head>identity'), 'cel dostał accept-encoding: identity')
}))

test('P28 (5) bez wstrzyknięcia: JSON, HTML skompresowany przez cel (bajty bez zmian) i HTML bez <head> (skrypt na początku)', () => zSerwerami((req, res) => {
  if (req.url === '/api') return res.end(JSON.stringify({ a: '<head>' }))
  if (req.url === '/gz') {
    res.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' })
    return res.end(gzipSync('<html><head></head></html>'))
  }
  res.writeHead(200, { 'content-type': 'text/html' })
  res.end('<p>fragment</p>')
}, async (_cel, proxy) => {
  assert.equal((await zapytaj(proxy.port, { path: '/api' })).body.toString(), '{"a":"<head>"}')
  const gz = await zapytaj(proxy.port, { path: '/gz', headers: { accept: 'text/html' } })
  assert.deepEqual(gz.body, gzipSync('<html><head></head></html>'))
  assert.equal((await zapytaj(proxy.port, { path: '/frag', headers: { accept: 'text/html' } })).body.toString(), `${SKRYPT_SIECI}<p>fragment</p>`)
}))

test('po recenzji: HTML z doctype bez <head> — skrypt po <html> (bez trybu quirks); sam doctype — po nim; HEAD i 304 bez buforowania', () => zSerwerami((req, res) => {
  if (req.url === '/304') { res.writeHead(304, { 'content-type': 'text/html' }); return res.end() }
  res.writeHead(200, { 'content-type': 'text/html', 'content-length': req.url === '/html' ? '43' : '30' })
  if (req.method === 'HEAD') return res.end()
  res.end(req.url === '/html' ? '<!DOCTYPE html><html lang="pl"><p>x</p>xxxx' : '<!doctype html><p>bez html</p>')
}, async (_cel, proxy) => {
  const html = (await zapytaj(proxy.port, { path: '/html', headers: { accept: 'text/html' } })).body.toString()
  assert.equal(html, `<!DOCTYPE html><html lang="pl">${SKRYPT_SIECI}<p>x</p>xxxx`)
  assert.equal((await zapytaj(proxy.port, { path: '/doc', headers: { accept: 'text/html' } })).body.toString(), `<!doctype html>${SKRYPT_SIECI}<p>bez html</p>`)
  const head = await zapytaj(proxy.port, { method: 'HEAD', path: '/html', headers: { accept: 'text/html' } })
  assert.equal(head.headers['content-length'], '43', 'HEAD z długością celu')
  const n = await zapytaj(proxy.port, { path: '/304', headers: { accept: 'text/html' } })
  assert.deepEqual([n.status, n.body.length, n.headers['content-length']], [304, 0, undefined])
}))

// Reverse proxy narzedzia makiet do lokalnej aplikacji (P24 IU-4). Strona narzedzia i ramki maja jeden origin (proxy), wiec
// ramki dziela localStorage i sesje logowania; proxy zdejmuje zakaz osadzania (naglowki.mjs), a cialo i `content-encoding`
// przekazuje bez zmian, strumieniem — poza stronami HTML (P28 (5)): do nich proxy wstrzykuje skrypt sieci narzedzia
// (`strona/siec.mjs`, panel „Sieć”) zaraz po `<head>`, a zadanie strony idzie do celu z `accept-encoding: identity`, zeby
// cialo dalo sie zmienic bez rozpakowywania; HTML skompresowany mimo to przechodzi bez zmian. SSE bez buforowania (`flushHeaders`), WebSocket (HMR Vite) przez `upgrade` z buforem `head`.
// Cel tylko lokalny, a naglowek Host musi byc originem proxy: proxy podmienia Host na swoj, wiec bez tej kontroli strona po
// DNS rebinding (Host obcej domeny) przeszlaby przez kontrole `allowedHosts` Vite i czytala zrodla oraz token HMR.
//
// Log: metoda, sciezka bez query i status — bez ciasteczek, `Authorization`, query z tokenami i cial `/auth/v1/*`
// (wyjscie narzedzia trafia do transkryptu sesji).

import { request } from 'node:http'

import { naglowkiOdpowiedzi, naglowkiZadania } from './naglowki.mjs'

export const PREFIKS_NARZEDZIA = '/__makieta/'
export const SKRYPT_SIECI = `<script src="${PREFIKS_NARZEDZIA}strona/siec.mjs"></script>`
const HOSTY_LOKALNE = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * @typedef {import('node:http').IncomingMessage} Zadanie
 * @typedef {import('node:http').ServerResponse} Odpowiedz
 * @typedef {import('node:stream').Duplex} Gniazdo
 */

export class BladProxy extends Error {
  /** @param {'cel-nielokalny'} kod @param {string} komunikat */
  constructor(kod, komunikat) {
    super(komunikat)
    this.name = 'BladProxy'
    this.kod = kod
  }
}

/**
 * Adres aplikacji z `--aplikacja`: http, host localhost / 127.0.0.1 / [::1]; porownanie po `new URL` (port domyslny, bez sciezki).
 * @param {string} adres
 * @returns {URL} origin celu
 */
export function celLokalny(adres) {
  /** @type {URL | null} */
  let u = null
  try {
    u = new URL(adres)
  } catch {
    // Niepoprawny adres to ten sam blad co adres nielokalny — ponizej.
  }
  if (!u || u.protocol !== 'http:' || !HOSTY_LOKALNE.has(u.hostname)) {
    throw new BladProxy('cel-nielokalny', `aplikacja „${adres}” — narzędzie przyjmuje tylko http://localhost, http://127.0.0.1 albo http://[::1] (z portem)`)
  }
  return new URL(u.origin)
}

/** @param {string} t @returns {string} */
const html = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** @param {Odpowiedz} res @param {URL} cel */
function stronaBrakuAplikacji(res, cel) {
  const tresc = `<!doctype html><html lang="pl"><meta charset="utf-8"><title>Aplikacja nie odpowiada</title>
<body style="font:16px/1.5 system-ui,sans-serif;margin:2rem;color:#222"><p>Aplikacja nie odpowiada pod ${html(cel.origin)} — uruchom ją i kliknij „Przeładuj ramki”.</p></body></html>`
  res.writeHead(502, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  res.end(tresc)
}

/** @param {Zadanie} req @returns {string} origin proxy: serwer nasluchuje na 127.0.0.1, port z gniazda */
const originProxy = (req) => `http://127.0.0.1:${req.socket.localPort}`

/** @param {string | undefined} url @returns {string} sciezka bez query (do logu) */
const bezQuery = (url) => (url ?? '/').replace(/[?#].*$/, '')

/** @param {import('node:http').IncomingHttpHeaders} n @returns {boolean} strona HTML, ktorej cialo da sie zmienic (bez kompresji) */
const htmlDoZmiany = (n) => /^text\/html\b/i.test(String(n['content-type'] ?? '')) && [undefined, 'identity'].includes(n['content-encoding'])

/**
 * @param {Buffer} html
 * @returns {Buffer} html ze skryptem sieci po `<head …>`, bez niego po `<html …>` albo po doctype (skrypt przed doctype
 *   przelacza strone w tryb quirks), a we fragmencie bez nich — na poczatku
 */
function zeSkryptemSieci(html) {
  const skrypt = Buffer.from(SKRYPT_SIECI)
  const tekst = html.toString('latin1')
  const m = /<head(?:\s[^>]*)?>/i.exec(tekst) ?? /<html(?:\s[^>]*)?>/i.exec(tekst) ?? /<!doctype[^>]*>/i.exec(tekst)
  if (!m) return Buffer.concat([skrypt, html])
  const po = m.index + m[0].length
  return Buffer.concat([html.subarray(0, po), skrypt, html.subarray(po)])
}

/**
 * @param {{ cel: URL, log?: (linia: string) => void }} opcje cel z `celLokalny`
 * @returns {{ obsluzZadanie: (req: Zadanie, res: Odpowiedz) => void, obsluzUpgrade: (req: Zadanie, gniazdo: Gniazdo, glowa: Buffer) => void }}
 */
export function utworzProxy({ cel, log = () => {} }) {
  const host = cel.hostname.replace(/^\[|\]$/g, '')
  const port = Number(cel.port) || 80
  /** @param {Zadanie} req @param {boolean} upgrade */
  const opcjeZadania = (req, upgrade) => {
    const headers = naglowkiZadania(req.headers, { cel: cel.origin, proxy: originProxy(req) }, { upgrade })
    // Strona HTML bez kompresji — proxy wstrzykuje do niej skrypt sieci (P28 (5)).
    if (/text\/html/i.test(String(req.headers.accept ?? ''))) headers['accept-encoding'] = 'identity'
    return { host, port, method: req.method, path: req.url, headers }
  }

  /** @param {Zadanie} req @returns {string | null} powod odmowy: Host spoza originu proxy albo adres w formie absolutnej */
  const odmowa = (req) => {
    if (req.headers.host !== `127.0.0.1:${req.socket.localPort}`) return `Host ${req.headers.host ?? '(brak)'} — tylko ${originProxy(req)}`
    return (req.url ?? '').startsWith('/') && !(req.url ?? '').startsWith('//') ? null : 'adres żądania musi być ścieżką'
  }

  /** @param {Zadanie} req @param {Odpowiedz} res */
  function obsluzZadanie(req, res) {
    const powod = odmowa(req)
    if (powod) {
      res.writeHead(powod.startsWith('Host') ? 421 : 400, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(powod)
      return
    }
    if ((req.url ?? '/').startsWith(PREFIKS_NARZEDZIA)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('nie ma takiej strony narzędzia')
      return
    }
    const doCelu = request(opcjeZadania(req, false), (odp) => {
      const naglowki = naglowkiOdpowiedzi(odp.headers, { cel: cel.origin, proxy: originProxy(req) })
      log(`${req.method} ${bezQuery(req.url)} ${odp.statusCode}`)
      odp.on('error', () => res.destroy())
      // Strona jest buforowana do konca (SSR ze strumieniowaniem dostaje pierwszy bajt po calej odpowiedzi) — dla stosu Vite
      // bez znaczenia. HEAD, 204 i 304 nie maja ciala, wiec ida bez zmian (z dlugoscia celu).
      if (req.method === 'HEAD' || odp.statusCode === 204 || odp.statusCode === 304 || !htmlDoZmiany(odp.headers)) {
        res.writeHead(odp.statusCode ?? 502, naglowki)
        res.flushHeaders()
        odp.pipe(res)
        return
      }
      /** @type {Buffer[]} */
      const czesci = []
      odp.on('data', (c) => czesci.push(c))
      odp.on('end', () => {
        const cialo = zeSkryptemSieci(Buffer.concat(czesci))
        res.writeHead(odp.statusCode ?? 502, { ...naglowki, 'content-length': String(cialo.length) })
        res.end(cialo)
      })
    })
    doCelu.on('error', (blad) => {
      // Klient sam przerwal (zamknieta ramka, przerwany upload) — to nie awaria aplikacji.
      if (res.destroyed) return log(`${req.method} ${bezQuery(req.url)} 499 (klient przerwał)`)
      log(`${req.method} ${bezQuery(req.url)} 502 (${blad instanceof Error && 'code' in blad ? blad.code : 'blad'})`)
      if (res.headersSent) res.destroy()
      else stronaBrakuAplikacji(res, cel)
    })
    req.on('error', () => doCelu.destroy())
    // Klient zamknal polaczenie (zamknieta ramka, przerwane SSE) — zadanie do celu tez konczymy.
    res.on('close', () => {
      if (!res.writableFinished) doCelu.destroy()
    })
    req.pipe(doCelu)
  }

  /** @param {Zadanie} req @param {Gniazdo} gniazdo @param {Buffer} glowa */
  function obsluzUpgrade(req, gniazdo, glowa) {
    if (odmowa(req)) {
      gniazdo.destroy()
      return
    }
    const doCelu = request(opcjeZadania(req, true))
    gniazdo.on('error', () => doCelu.destroy())
    doCelu.on('upgrade', (odp, gniazdoCelu, glowaCelu) => {
      const linie = [`HTTP/1.1 ${odp.statusCode} ${odp.statusMessage}`]
      for (let i = 0; i < odp.rawHeaders.length; i += 2) linie.push(`${odp.rawHeaders[i]}: ${odp.rawHeaders[i + 1]}`)
      gniazdo.write(`${linie.join('\r\n')}\r\n\r\n`)
      if (glowaCelu.length) gniazdo.write(glowaCelu)
      if (glowa.length) gniazdoCelu.write(glowa)
      // Gniazda z `upgrade` serwera http sa pol-otwarte (allowHalfOpen) i nie zamyka ich `closeAllConnections` — koniec
      // ktorejkolwiek strony (zamknieta ramka, restart Vite) zamyka obie, inaczej polaczenie wisi do konca procesu.
      const zamknijObie = () => {
        gniazdo.destroy()
        gniazdoCelu.destroy()
      }
      for (const g of [gniazdo, gniazdoCelu]) for (const zdarzenie of ['end', 'close', 'error']) g.on(zdarzenie, zamknijObie)
      gniazdoCelu.pipe(gniazdo).pipe(gniazdoCelu)
      log(`UPGRADE ${bezQuery(req.url)} ${odp.statusCode}`)
    })
    doCelu.on('response', (odp) => {
      // Cel odmowil uzgodnienia (zwykla odpowiedz) — oddajemy status i zamykamy gniazdo.
      log(`UPGRADE ${bezQuery(req.url)} ${odp.statusCode} (odmowa celu)`)
      gniazdo.end(`HTTP/1.1 ${odp.statusCode} ${odp.statusMessage}\r\nconnection: close\r\ncontent-length: 0\r\n\r\n`)
      odp.resume()
    })
    doCelu.on('error', () => {
      log(`UPGRADE ${bezQuery(req.url)} 502`)
      gniazdo.end('HTTP/1.1 502 Bad Gateway\r\nconnection: close\r\ncontent-length: 0\r\n\r\n')
    })
    doCelu.end()
  }

  return { obsluzZadanie, obsluzUpgrade }
}

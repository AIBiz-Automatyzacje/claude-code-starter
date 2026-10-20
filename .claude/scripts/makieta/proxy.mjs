// Reverse proxy narzedzia makiet do lokalnej aplikacji (P24 IU-4). Strona narzedzia i ramki maja jeden origin (proxy), wiec
// ramki dziela localStorage i sesje logowania; proxy zdejmuje zakaz osadzania (naglowki.mjs), a cialo i `content-encoding`
// przekazuje bez zmian, strumieniem. SSE bez buforowania (`flushHeaders`), WebSocket (HMR Vite) przez `upgrade` z buforem `head`.
// Cel tylko lokalny: proxy zdejmuje ochrone przed clickjackingiem, wiec nie moze wskazywac uslugi spoza maszyny operatora.
//
// Log: metoda, sciezka bez query i status — bez ciasteczek, `Authorization`, query z tokenami i cial `/auth/v1/*`
// (wyjscie narzedzia trafia do transkryptu sesji).

import { request } from 'node:http'

import { naglowkiOdpowiedzi, naglowkiZadania } from './naglowki.mjs'

export const PREFIKS_NARZEDZIA = '/__makieta/'
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

/**
 * @param {{ cel: URL, log?: (linia: string) => void }} opcje cel z `celLokalny`
 * @returns {{ obsluzZadanie: (req: Zadanie, res: Odpowiedz) => void, obsluzUpgrade: (req: Zadanie, gniazdo: Gniazdo, glowa: Buffer) => void }}
 */
export function utworzProxy({ cel, log = () => {} }) {
  const host = cel.hostname.replace(/^\[|\]$/g, '')
  const port = Number(cel.port) || 80
  /** @param {Zadanie} req @param {boolean} upgrade */
  const opcjeZadania = (req, upgrade) => ({
    host, port, method: req.method, path: req.url,
    headers: naglowkiZadania(req.headers, { cel: cel.origin, proxy: originProxy(req) }, { upgrade }),
  })

  /** @param {Zadanie} req @param {Odpowiedz} res */
  function obsluzZadanie(req, res) {
    if ((req.url ?? '/').startsWith(PREFIKS_NARZEDZIA)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('nie ma takiej strony narzędzia')
      return
    }
    const doCelu = request(opcjeZadania(req, false), (odp) => {
      res.writeHead(odp.statusCode ?? 502, naglowkiOdpowiedzi(odp.headers, { cel: cel.origin, proxy: originProxy(req) }))
      res.flushHeaders()
      log(`${req.method} ${bezQuery(req.url)} ${odp.statusCode}`)
      odp.on('error', () => res.destroy())
      odp.pipe(res)
    })
    doCelu.on('error', (blad) => {
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

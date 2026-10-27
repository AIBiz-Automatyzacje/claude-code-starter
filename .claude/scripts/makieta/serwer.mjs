// Serwer narzedzia makiet (P24 IU-5): jeden origin `http://127.0.0.1:<port>` dla strony narzedzia (`/__makieta/`) i ramek
// aplikacji (reszta sciezek przez proxy.mjs) — ramki sa same-origin ze strona i dziela localStorage (jedna sesja logowania).
// Trasy narzedzia: strona i jej statyka, PNG makiet (tylko ekrany z punktow), punkty ze statusami, zapis decyzji do linii
// checklisty (zapis-linii.mjs; konflikt = 409), kolejka zgloszen dla sesji (kolejka.mjs) i zdarzenia SSE (`punkty` po zmianie
// pliku smoke'u, `przeladuj` z CLI po poprawce). Tryb zgloszen (P28): „na-koniec” (domyslny) — „Zgłoś błąd” zapisuje tylko
// linie, `api/zakoncz` oddaje sesji wszystkie otwarte zgloszenia naraz; „od-razu” — kazde zgloszenie trafia do kolejki od razu.
// Zrzut operatora (P27 S3): `api/zrzut` zapisuje PNG w `visual-diff/zgloszenia/<punkt>-<n>.png` katalogu zadania (sesja
// commituje go z artefaktami — nie zostaje nieśledzony plik poza zadaniem), decyzja „blad” niesie jego sciezke.
//
// Ochrona: nasluch tylko na 127.0.0.1 (robi go CLI), naglowek Host musi byc originem narzedzia (DNS rebinding), API wymaga
// tokenu z linku startowego (`x-makieta-token`, SSE — w query), POST z obcym `Origin` = 403. Odpowiedzi API: { data, error }.

import { timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unwatchFile, watchFile, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { dopiszPrzeglad, dopiszZgloszenie, opisOtwartych, podsumowanie } from './kolejka.mjs'
import { PREFIKS_NARZEDZIA, utworzProxy } from './proxy.mjs'
import { punktyWizualne } from './punkty.mjs'
import { BladZapisu, oczyscNotatke, skrotSha1, zapiszDecyzje } from './zapis-linii.mjs'
import { zrodlaMakiet } from './zrodla.mjs'

export const NAGLOWEK_TOKENU = 'x-makieta-token'
const KATALOG = dirname(fileURLToPath(import.meta.url))
const WSPOLNE = new Set(['urzadzenia.mjs'])
const NAZWA_PLIKU = /^[A-Za-z0-9][\w-]*\.(?:html|css|mjs|svg|png)$/
const TYPY = /** @type {const} */ ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' })
const LIMIT_CIALA = 16 * 1024
const LIMIT_ZRZUTU = 5 * 1024 * 1024
const KATALOG_ZRZUTOW = 'visual-diff/zgloszenia'
const SYGNATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ID_PUNKTU = /^p-[0-9a-f]{8}$/
const LIMIT_ODRZUCENIA = 1024 * 1024
const MIN_DLUGOSC_TOKENU = 16
const ODSTEP_OBSERWACJI_MS = 1000
const ODSTEP_PULSU_MS = 25_000
const NAGLOWKI_NARZEDZIA = {
  'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
}

/**
 * @typedef {import('node:http').IncomingMessage} Zadanie
 * @typedef {import('node:http').ServerResponse} Odpowiedz
 * @typedef {'na-koniec' | 'od-razu'} TrybZgloszen
 * @typedef {{ projekt: string, smoke: string, aplikacja: URL, token: string, katalogStanu: string, katalogStrony?: string, zgloszenia?: TrybZgloszen,
 *   log?: (linia: string) => void }} OpcjeSerwera
 */

/** @param {Odpowiedz} res @param {number} status @param {{ data?: unknown, error?: { code: string, message: string } }} koperta */
function json(res, status, koperta) {
  res.writeHead(status, { ...NAGLOWKI_NARZEDZIA, 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ data: koperta.data ?? null, error: koperta.error ?? null }))
}

/** @param {Odpowiedz} res @param {number} status @param {string} code @param {string} message */
const blad = (res, status, code, message) => json(res, status, { error: { code, message } })

/** @param {Odpowiedz} res @param {string} plik @param {string} typ */
function plik(res, plik, typ) {
  if (!existsSync(plik) || !statSync(plik).isFile()) return blad(res, 404, 'brak', 'nie ma takiego pliku narzędzia')
  res.writeHead(200, { ...NAGLOWKI_NARZEDZIA, 'content-type': typ })
  res.end(readFileSync(plik))
}

/** @param {string | undefined} a @param {string} b @returns {boolean} porownanie tokenu w stalym czasie */
function tokenZgodny(a, b) {
  const x = Buffer.from(a ?? '')
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Cialo do `limit` bajtow. Nadmiar czytamy bez zapamietywania (odpowiedz 413 dochodzi do klienta), a powyzej limitu
 * i LIMIT_ODRZUCENIA zrywamy polaczenie.
 * @param {Zadanie} req
 * @param {number} limit
 * @returns {Promise<Buffer>}
 */
function czytajCialo(req, limit) {
  return new Promise((ok, nie) => {
    /** @type {Buffer[]} */
    const czesci = []
    let rozmiar = 0
    req.on('data', (c) => {
      rozmiar += c.length
      if (rozmiar <= limit) czesci.push(c)
      else if (rozmiar > limit + LIMIT_ODRZUCENIA) req.destroy()
    })
    req.on('end', () => {
      if (rozmiar > limit) return nie(Object.assign(new Error('za duże ciało żądania'), { status: 413 }))
      ok(Buffer.concat(czesci))
    })
    req.on('error', nie)
    // Polaczenie zerwane (przez limit albo klienta) bez `end` — obietnica nie wisi do konca procesu.
    req.on('close', () => { if (!req.complete) nie(Object.assign(new Error('żądanie przerwane'), { status: 413 })) })
  })
}

/** @param {Zadanie} req @returns {Promise<unknown>} cialo JSON do LIMIT_CIALA bajtow */
async function czytajJson(req) {
  const cialo = await czytajCialo(req, LIMIT_CIALA)
  try {
    return JSON.parse(cialo.toString('utf8'))
  } catch {
    throw Object.assign(new Error('ciało żądania to nie JSON'), { status: 400 })
  }
}

/**
 * Zrzut zapisany pod kolejnym wolnym numerem; `wx` — rownolegle zapisy nie nadpisza sie nawzajem.
 * @param {string} katalog bezwzgledny katalog zrzutow @param {string} punkt @param {Buffer} png
 * @returns {string} nazwa pliku
 */
function zapiszZrzut(katalog, punkt, png) {
  mkdirSync(katalog, { recursive: true })
  const numery = readdirSync(katalog).map((n) => new RegExp(`^${punkt}-(\\d+)\\.png$`).exec(n)?.[1]).filter((n) => n !== undefined).map(Number)
  for (let n = Math.max(0, ...numery) + 1; ; n += 1) {
    const nazwa = `${punkt}-${n}.png`
    try {
      writeFileSync(join(katalog, nazwa), png, { flag: 'wx' })
      return nazwa
    } catch (b) {
      if (!(b instanceof Error && 'code' in b && b.code === 'EEXIST')) throw b
    }
  }
}

/** @param {string} t @returns {string | null} decodeURIComponent bez wyjatku (zle kodowanie = null) */
function zdekodowana(t) {
  try {
    return decodeURIComponent(t)
  } catch {
    // Zle kodowanie procentowe (`%E0%A4%A`) to nieistniejacy plik, nie awaria serwera.
    return null
  }
}

/** @param {unknown} v @param {number} limit @returns {v is string | undefined} */
const tekstOpcjonalny = (v, limit) => v === undefined || (typeof v === 'string' && v.length <= limit)

/**
 * Cialo decyzji ze strony: `{ punkt, linia, decyzja, notatka?, urzadzenie?, szerokosc?, ekran?, zrzut? }`.
 * @param {unknown} c
 * @returns {{ punkt: string, linia: string, decyzja: 'zgodne' | 'odstepstwo' | 'blad', notatka?: string, urzadzenie?: string, szerokosc?: number, ekran?: string,
 *   zrzut?: string } | null}
 */
function cialoDecyzji(c) {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) return null
  const o = /** @type {Record<string, unknown>} */ (c)
  const dozwolone = new Set(['punkt', 'linia', 'decyzja', 'notatka', 'urzadzenie', 'szerokosc', 'ekran', 'zrzut'])
  if (Object.keys(o).some((k) => !dozwolone.has(k))) return null
  const { punkt, linia, decyzja, notatka, urzadzenie, szerokosc, ekran, zrzut } = o
  if (typeof punkt !== 'string' || !ID_PUNKTU.test(punkt) || typeof linia !== 'string' || linia.length > 20_000) return null
  // Strona nie wysyla „poprawione” — ten sygnal daje sesja przez CLI po tescie i commicie poprawki.
  if (decyzja !== 'zgodne' && decyzja !== 'odstepstwo' && decyzja !== 'blad') return null
  if (!tekstOpcjonalny(notatka, 2000) || !tekstOpcjonalny(urzadzenie, 200) || !tekstOpcjonalny(ekran, 200) || !tekstOpcjonalny(zrzut, 300)) return null
  if (zrzut !== undefined && decyzja !== 'blad') return null
  if (szerokosc !== undefined && typeof szerokosc !== 'number') return null
  return { punkt, linia, decyzja, notatka, urzadzenie, szerokosc, ekran, zrzut }
}

/**
 * @param {OpcjeSerwera} o
 * @returns {{ serwer: import('node:http').Server, przeladuj: () => void, zamknij: () => Promise<void> }}
 */
export function utworzSerwer({ projekt, smoke, aplikacja, token, katalogStanu, katalogStrony = join(KATALOG, 'strona'), zgloszenia = 'na-koniec', log = () => {} }) {
  // Pusty albo krotki token otwieralby API kazdej stronie, ktora zgadnie port.
  if (token.length < MIN_DLUGOSC_TOKENU) throw new Error(`token narzędzia krótszy niż ${MIN_DLUGOSC_TOKENU} znaków`)
  const plikSmoke = isAbsolute(smoke) ? smoke : join(projekt, smoke)
  const proxy = utworzProxy({ cel: aplikacja, log })
  /** @type {Set<Odpowiedz>} */
  const sluchacze = new Set()
  // Gniazd po upgrade (HMR) nie zamyka `closeAllConnections` — bez wlasnej listy `close` czekalby na nie bez konca.
  /** @type {Set<import('node:stream').Duplex>} */
  const gniazdaUpgrade = new Set()

  const stan = () => {
    const punkty = punktyWizualne(readFileSync(plikSmoke, 'utf8'), skrotSha1)
    return { punkty, zrodla: zrodlaMakiet(projekt, smoke, punkty) }
  }
  /** @param {'punkty' | 'przeladuj'} zdarzenie */
  const rozeslij = (zdarzenie) => {
    for (const res of sluchacze) if (!res.writableEnded) res.write(`event: ${zdarzenie}\ndata: {}\n\n`)
  }
  const naZmiane = () => rozeslij('punkty')
  watchFile(plikSmoke, { interval: ODSTEP_OBSERWACJI_MS }, naZmiane)
  const puls = setInterval(() => { for (const res of sluchacze) if (!res.writableEnded) res.write(': puls\n\n') }, ODSTEP_PULSU_MS)
  puls.unref()

  /** @param {Zadanie} req @returns {boolean} Host = origin narzedzia (127.0.0.1 i port nasluchu) */
  const hostZgodny = (req) => req.headers.host === `127.0.0.1:${req.socket.localPort}`

  /** @param {Odpowiedz} res */
  function punkty(res) {
    const { punkty: lista, zrodla } = stan()
    json(res, 200, { data: {
      smoke: zrodla.smoke, zadanie: zrodla.zadanie, aplikacja: aplikacja.origin, pominiete: zrodla.pominiete, ostrzezenia: zrodla.ostrzezenia, zgloszenia,
      punkty: lista.map(({ adnotacje, checkbox, ...p }) => p),
      ekrany: zrodla.ekrany.map((e) => ({ ...e, url: e.makieta ? `${PREFIKS_NARZEDZIA}makieta/${encodeURIComponent(e.ekran)}.png` : null })),
    } })
  }

  /** @param {Zadanie} req @param {Odpowiedz} res */
  async function decyzja(req, res) {
    const c = cialoDecyzji(await czytajJson(req))
    if (!c) return blad(res, 400, 'zle-cialo', 'oczekiwane { punkt, linia, decyzja: zgodne|odstepstwo|blad, notatka?, urzadzenie?, szerokosc?, ekran?, zrzut? (tylko blad) }')
    const { punkty: lista, zrodla } = stan()
    const { ekran, ...zapis } = c
    const p = lista.find((x) => x.id === c.punkt)
    if (p && ekran !== undefined && !p.ekrany.includes(ekran)) return blad(res, 400, 'zle-cialo', `ekran ${ekran} nie należy do punktu (${p.ekrany.join(', ')})`)
    if (c.zrzut !== undefined && !zrzutPunktu(c.zrzut, c.punkt, zrodla.katalogZadania)) return blad(res, 400, 'zle-cialo', `zrzut ${c.zrzut} nie jest zrzutem tego punktu z ${zrodla.katalogZadania}/${KATALOG_ZRZUTOW}/`)
    const w = await zapiszDecyzje({ plik: plikSmoke, katalogStanu, ...zapis })
    if (w.wynik === 'konflikt') return json(res, 409, { data: { powod: w.powod, linia: w.linia }, error: { code: 'konflikt', message: 'Sesja zmieniła ten punkt w międzyczasie.' } })
    /** @type {string | undefined} */
    let ostrzezenie
    if (c.decyzja === 'blad' && p && zgloszenia === 'od-razu') {
      const e = zrodla.ekrany.find((x) => x.punkt === c.punkt && x.ekran === (ekran ?? p.ekrany[0])) ?? null
      try {
        dopiszZgloszenie(katalogStanu, {
          punkt: c.punkt, ekran: e?.ekran ?? p.ekrany[0], trasa: p.trasa, viewport: e?.wymiary ?? p.viewport,
          urzadzenie: oczyscNotatke(c.urzadzenie ?? ''), szerokosc: c.szerokosc ?? 0, opis: oczyscNotatke(c.notatka ?? ''), spec: e?.spec ?? null, makieta: e?.makieta ?? null,
          zrzut: c.zrzut ?? null,
        })
      } catch (b) {
        // Linia checklisty juz zapisana (stan punktu) — zgloszenie dojdzie do sesji droga awaryjna `makieta.mjs zgloszenia`.
        log(`kolejka: ${b instanceof Error ? b.message : String(b)}`)
        ostrzezenie = 'Zgłoszenie zapisane w checkliście, ale nie w kolejce sesji — napisz w sesji „zgłoszenia”.'
      }
    }
    rozeslij('punkty')
    json(res, 200, { data: { linia: w.linia, ...(ostrzezenie ? { ostrzezenie } : {}) } })
  }

  /**
   * @param {string} zrzut sciezka z ciala decyzji @param {string} punkt @param {string} katalogZadania
   * @returns {boolean} zrzut zapisany przez `api/zrzut` dla tego punktu (bez wyjscia poza katalog zrzutow)
   */
  const zrzutPunktu = (zrzut, punkt, katalogZadania) => {
    const prefiks = `${katalogZadania}/${KATALOG_ZRZUTOW}/`
    return zrzut.startsWith(prefiks) && new RegExp(`^${punkt}-[1-9]\\d*\\.png$`).test(zrzut.slice(prefiks.length)) && existsSync(join(projekt, zrzut))
  }

  /** @param {Zadanie} req @param {Odpowiedz} res @param {URL} url zrzut operatora do zgloszenia: surowy PNG w ciele, punkt w query */
  async function zrzut(req, res, url) {
    const punkt = url.searchParams.get('punkt') ?? ''
    const typ = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
    // Odpowiedz przed cialem: reszte ciala czytamy w tle, zeby klient dostal status zamiast zerwanego polaczenia.
    if (!ID_PUNKTU.test(punkt) || typ !== 'image/png') {
      req.resume()
      return ID_PUNKTU.test(punkt) ? blad(res, 415, 'typ', 'zrzut tylko jako image/png') : blad(res, 400, 'zle-cialo', 'oczekiwane ?punkt=p-<8 hex>')
    }
    const png = await czytajCialo(req, LIMIT_ZRZUTU)
    if (!png.subarray(0, SYGNATURA_PNG.length).equals(SYGNATURA_PNG)) return blad(res, 415, 'typ', 'treść zrzutu to nie PNG')
    const { punkty: lista, zrodla } = stan()
    if (!lista.some((x) => x.id === punkt)) return blad(res, 404, 'brak-punktu', `brak punktu ${punkt} w checkliście`)
    const nazwa = zapiszZrzut(join(projekt, zrodla.katalogZadania, KATALOG_ZRZUTOW), punkt, png)
    json(res, 200, { data: { zrzut: `${zrodla.katalogZadania}/${KATALOG_ZRZUTOW}/${nazwa}` } })
  }

  /** @param {Odpowiedz} res koniec przegladu: jeden wpis kolejki z otwartymi zgloszeniami z checklisty i podsumowaniem statusow */
  function zakoncz(res) {
    if (zgloszenia !== 'na-koniec') return blad(res, 409, 'tryb', 'zgłoszenia trafiają do sesji od razu — nie ma czego wysyłać na koniec')
    const { punkty: lista, zrodla } = stan()
    const otwarte = opisOtwartych(lista, zrodla)
    try {
      dopiszPrzeglad(katalogStanu, { smoke: zrodla.smoke, zgloszenia: otwarte, podsumowanie: podsumowanie(lista) })
    } catch (b) {
      // Zgloszenia sa w checkliście — sesja odczyta je droga awaryjna `makieta.mjs zgloszenia`.
      log(`kolejka: ${b instanceof Error ? b.message : String(b)}`)
      return blad(res, 503, 'kolejka', 'Nie udało się przekazać przeglądu do kolejki sesji — zgłoszenia są w checkliście, napisz w sesji „zgłoszenia”.')
    }
    json(res, 200, { data: { zgloszenia: otwarte.length } })
  }

  /** @param {Odpowiedz} res */
  function zdarzenia(res) {
    res.writeHead(200, { ...NAGLOWKI_NARZEDZIA, 'content-type': 'text/event-stream; charset=utf-8', connection: 'keep-alive' })
    res.write(': start\n\n')
    sluchacze.add(res)
    res.on('close', () => sluchacze.delete(res))
  }

  /** @param {Zadanie} req @param {Odpowiedz} res @param {string} sciezka @param {URL} url */
  async function api(req, res, sciezka, url) {
    const zToken = sciezka === 'api/zdarzenia' ? url.searchParams.get('t') ?? undefined : [req.headers[NAGLOWEK_TOKENU]].flat()[0]
    if (!tokenZgodny(zToken, token)) return blad(res, 403, 'token', 'brak albo zły token narzędzia — otwórz link z wyniku makieta.mjs start')
    const origin = req.headers.origin
    if (req.method === 'POST' && origin !== undefined && origin !== `http://127.0.0.1:${req.socket.localPort}`) return blad(res, 403, 'origin', 'żądanie z obcej strony')
    if (req.method === 'GET' && sciezka === 'api/punkty') return punkty(res)
    if (req.method === 'GET' && sciezka === 'api/zdarzenia') return zdarzenia(res)
    if (req.method === 'POST' && sciezka === 'api/decyzja') return decyzja(req, res)
    if (req.method === 'POST' && sciezka === 'api/zakoncz') return zakoncz(res)
    if (req.method === 'POST' && sciezka === 'api/zrzut') return zrzut(req, res, url)
    if (req.method === 'POST' && sciezka === 'api/przeladuj') {
      rozeslij('przeladuj')
      return json(res, 200, { data: { sluchacze: sluchacze.size } })
    }
    blad(res, 404, 'brak', 'nie ma takiej trasy API')
  }

  /** @param {Zadanie} req @param {Odpowiedz} res @param {string} sciezka */
  function statyka(req, res, sciezka) {
    if (req.method !== 'GET') return blad(res, 405, 'metoda', 'tylko GET')
    if (sciezka === '') return plik(res, join(katalogStrony, 'index.html'), TYPY['.html'])
    // Modul wspolny ze strona (urzadzenia.mjs) lezy obok serwera — strona importuje go jako `../urzadzenia.mjs`.
    if (WSPOLNE.has(sciezka)) return plik(res, join(KATALOG, sciezka), TYPY['.mjs'])
    const [katalog, nazwa, ...reszta] = sciezka.split('/')
    if (reszta.length || !nazwa) return blad(res, 404, 'brak', 'nie ma takiego pliku narzędzia')
    if (katalog === 'strona' && NAZWA_PLIKU.test(nazwa)) return plik(res, join(katalogStrony, nazwa), TYPY[/** @type {keyof typeof TYPY} */ (extname(nazwa))])
    if (katalog === 'makieta' && nazwa.endsWith('.png')) {
      const ekran = zdekodowana(nazwa.slice(0, -'.png'.length))
      const e = ekran === null ? undefined : stan().zrodla.ekrany.find((x) => x.ekran === ekran && x.makieta)
      if (e?.makieta) return plik(res, join(projekt, e.makieta), TYPY['.png'])
    }
    blad(res, 404, 'brak', 'nie ma takiego pliku narzędzia')
  }

  /** @param {Zadanie} req @param {Odpowiedz} res */
  async function obsluz(req, res) {
    const surowa = (req.url ?? '/').split('?')[0]
    if (!hostZgodny(req)) return blad(res, 421, 'host', `otwórz narzędzie pod http://127.0.0.1:${req.socket.localPort}${PREFIKS_NARZEDZIA} — z innego adresu sesja logowania i makiety nie działają`)
    if (!surowa.startsWith(PREFIKS_NARZEDZIA)) return proxy.obsluzZadanie(req, res)
    const sciezka = surowa.slice(PREFIKS_NARZEDZIA.length)
    log(`${req.method} ${surowa}`)
    if (sciezka.startsWith('api/')) return api(req, res, sciezka, new URL(req.url ?? '/', 'http://127.0.0.1'))
    statyka(req, res, sciezka)
  }

  const serwer = createServer((req, res) => {
    obsluz(req, res).catch((b) => {
      const status = b && typeof b === 'object' && 'status' in b && typeof b.status === 'number' ? b.status : b instanceof BladZapisu ? (b.kod === 'odmowa' ? 400 : 503) : 500
      log(`${req.method} ${(req.url ?? '/').split('?')[0]} ${status}: ${b instanceof Error ? b.message : String(b)}`)
      if (res.headersSent) return res.destroy()
      // Szczegol bledu (sciezki plikow) tylko w logu serwera; strona dostaje kod i ogolny komunikat.
      const komunikat = status === 500 ? 'błąd serwera narzędzia — szczegół w serwer.log' : b instanceof Error ? b.message : String(b)
      blad(res, status, b instanceof BladZapisu ? b.kod : 'serwer', komunikat)
    })
  })
  serwer.on('upgrade', (req, gniazdo, glowa) => {
    if (!hostZgodny(req) || (req.url ?? '/').startsWith(PREFIKS_NARZEDZIA)) return gniazdo.destroy()
    gniazdaUpgrade.add(gniazdo)
    gniazdo.on('close', () => gniazdaUpgrade.delete(gniazdo))
    proxy.obsluzUpgrade(req, gniazdo, glowa)
  })

  return {
    serwer,
    przeladuj: () => rozeslij('przeladuj'),
    zamknij: () => new Promise((ok) => {
      unwatchFile(plikSmoke, naZmiane)
      clearInterval(puls)
      const otwarte = [...sluchacze]
      sluchacze.clear()
      for (const res of otwarte) res.end()
      for (const g of gniazdaUpgrade) g.destroy()
      serwer.closeAllConnections()
      serwer.close(() => ok())
    }),
  }
}

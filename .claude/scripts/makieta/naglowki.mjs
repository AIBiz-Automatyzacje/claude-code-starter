// Naglowki proxy narzedzia makiet (P24 IU-4). Ramki strony narzedzia laduja aplikacje przez proxy z tego samego originu, wiec
// proxy zamienia zakaz osadzania na „tylko ten origin”: `X-Frame-Options: SAMEORIGIN` na kazdej odpowiedzi i dyrektywa
// `frame-ancestors 'self'` zamiast oryginalnej w kazdej polityce CSP (takze `-Report-Only`). Samo zdjecie zakazu (pierwsza
// wersja planu) pozwalaloby obcej stronie osadzic aplikacje z sesja operatora (clickjacking) — ramki narzedzia tego nie
// potrzebuja. `Strict-Transport-Security` znika (origin proxy to http://127.0.0.1). Reszta CSP zostaje — smoke dalej widzi
// prawdziwe bledy CSP. `frame-ancestors` w `<meta>` przegladarki ignoruja, wiec wystarcza naglowki HTTP.
//
// Proxy to origin aplikacji dla przegladarki: `Location` na cel (absolutne, bez schematu, localhost/127.0.0.1/[::1] na porcie
// celu) wraca na origin proxy, `Set-Cookie` bez `Domain` i `Secure` (http), `SameSite=None` bez `Secure` przegladarka odrzuca —
// zamiana na `Lax`; ciasteczka `__Host-`/`__Secure-` i `Partitioned` zachowuja `Secure` (bez niego i tak by przepadly).
// Naglowki hop-by-hop (RFC 9110 §7.6.1 i wymienione w `Connection`) nie przechodza w zadnym kierunku — z wyjatkiem `Host`
// i `Content-Length` wymienionych w `Connection` (ich zdjecie rozjezdza ramkowanie ciala); cialo z `Transfer-Encoding` idzie
// do celu jako chunked (Node dla GET/DELETE bez tego naglowka wysyla cialo surowo — przemyt zadania).

const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade']
const CHRONIONE_PRZED_CONNECTION = new Set(['host', 'content-length'])
const POLITYKI_CSP = ['content-security-policy', 'content-security-policy-report-only']
const HOSTY_LOKALNE = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * @typedef {Record<string, string | string[] | undefined>} Naglowki
 * @typedef {{ cel: string, proxy: string }} Adresy originy aplikacji i proxy
 */

/**
 * CSP z dyrektywa `frame-ancestors` (pierwszy token, bez wzgledu na wielkosc liter) zamieniona na `frame-ancestors 'self'`
 * w kazdej polityce listy, ktora ja miala; puste polityki pominiete.
 * @param {string} csp wartosc naglowka; polityki po `,`, dyrektywy po `;`
 * @returns {string | null} null, gdy nie zostala zadna niepusta polityka
 */
export function frameAncestorsSelf(csp) {
  const polityki = csp.split(',').map((polityka) => {
    const dyrektywy = polityka.split(';').map((d) => d.trim()).filter(Boolean)
    const reszta = dyrektywy.filter((d) => d.split(/\s+/)[0].toLowerCase() !== 'frame-ancestors')
    return (reszta.length < dyrektywy.length ? [...reszta, "frame-ancestors 'self'"] : reszta).join('; ')
  }).filter(Boolean)
  return polityki.length ? polityki.join(', ') : null
}

/** @param {Naglowki} naglowki @param {{ upgrade?: boolean }} opcje @returns {Set<string>} nazwy do zdjecia jako hop-by-hop */
function hopByHop(naglowki, { upgrade = false } = {}) {
  const zConnection = String(naglowki.connection ?? '').split(',').map((t) => t.trim().toLowerCase())
    .filter((t) => t && !CHRONIONE_PRZED_CONNECTION.has(t))
  const nazwy = new Set([...HOP_BY_HOP, ...zConnection])
  // Uzgodnienie WebSocketu potrzebuje `Connection: Upgrade` i `Upgrade` do celu — reszta hop-by-hop i tak odpada.
  if (upgrade) for (const n of ['connection', 'upgrade']) nazwy.delete(n)
  return nazwy
}

/** @param {URL} a @param {URL} b @returns {boolean} ten sam origin albo oba lokalne (localhost, 127.0.0.1, [::1]) na tym samym porcie */
const tenSamCel = (a, b) => a.origin === b.origin || (a.protocol === b.protocol && a.port === b.port && HOSTY_LOKALNE.has(a.hostname) && HOSTY_LOKALNE.has(b.hostname))

/** @param {string} wartosc @param {Adresy} adresy @returns {string} */
function przepiszLocation(wartosc, adresy) {
  if (!/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(wartosc)) return wartosc
  try {
    const u = new URL(wartosc, adresy.cel)
    return tenSamCel(u, new URL(adresy.cel)) ? `${new URL(adresy.proxy).origin}${u.pathname}${u.search}${u.hash}` : wartosc
  } catch {
    // Niepoprawny adres absolutny — przegladarka i tak go odrzuci; przekazujemy bez zmian, jak aplikacja go wyslala.
    return wartosc
  }
}

/** @param {string} ciasteczko @returns {string} bez atrybutow Domain i Secure (poza prefiksami wymagajacymi Secure), SameSite=None → Lax */
function przepiszCiasteczko(ciasteczko) {
  const [para, ...atrybuty] = ciasteczko.split(';')
  const czyste = atrybuty.map((a) => a.trim()).filter((a) => a && !/^domain\s*=/i.test(a))
  const wymagaSecure = /^\s*__(?:Host|Secure)-/.test(para) || czyste.some((a) => /^partitioned$/i.test(a))
  if (wymagaSecure) return [para.trim(), ...czyste].join('; ')
  const zostaja = czyste.filter((a) => !/^secure\s*(?:=.*)?$/i.test(a)).map((a) => /^samesite\s*=\s*none$/i.test(a) ? 'SameSite=Lax' : a)
  return [para.trim(), ...zostaja].join('; ')
}

/**
 * Naglowki odpowiedzi aplikacji dla przegladarki (nazwy malymi literami, jak `IncomingMessage.headers`).
 * @param {Naglowki} naglowki
 * @param {Adresy} adresy
 * @returns {Naglowki}
 */
export function naglowkiOdpowiedzi(naglowki, adresy) {
  const pomijane = hopByHop(naglowki)
  /** @type {Naglowki} */
  const wynik = {}
  for (const [nazwa, wartosc] of Object.entries(naglowki)) {
    if (wartosc === undefined || pomijane.has(nazwa) || nazwa === 'strict-transport-security' || nazwa === 'x-frame-options') continue
    if (POLITYKI_CSP.includes(nazwa)) {
      const csp = frameAncestorsSelf([wartosc].flat().join(', '))
      if (csp) wynik[nazwa] = csp
    } else if (nazwa === 'location') wynik[nazwa] = przepiszLocation(String(wartosc), adresy)
    else if (nazwa === 'set-cookie') wynik[nazwa] = [wartosc].flat().map(przepiszCiasteczko)
    else wynik[nazwa] = wartosc
  }
  return { ...wynik, 'x-frame-options': 'SAMEORIGIN' }
}

/**
 * Naglowki zadania przegladarki do aplikacji: bez hop-by-hop, `Host` = origin proxy (aplikacja widzi swoj `'self'`),
 * `X-Forwarded-Host` i `X-Forwarded-Proto`; cialo z `Transfer-Encoding` jako chunked.
 * @param {Naglowki} naglowki
 * @param {Adresy} adresy
 * @param {{ upgrade?: boolean }} [opcje] upgrade: zostaja `Connection` i `Upgrade` (WebSocket)
 * @returns {Naglowki}
 */
export function naglowkiZadania(naglowki, adresy, opcje = {}) {
  const pomijane = hopByHop(naglowki, opcje)
  const host = new URL(adresy.proxy).host
  /** @type {Naglowki} */
  const wynik = {}
  for (const [nazwa, wartosc] of Object.entries(naglowki)) {
    if (wartosc !== undefined && !pomijane.has(nazwa)) wynik[nazwa] = wartosc
  }
  if (naglowki['transfer-encoding'] !== undefined) {
    delete wynik['content-length']
    wynik['transfer-encoding'] = 'chunked'
  }
  return { ...wynik, host, 'x-forwarded-host': host, 'x-forwarded-proto': 'http' }
}

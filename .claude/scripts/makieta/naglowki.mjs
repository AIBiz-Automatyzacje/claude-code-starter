// Naglowki proxy narzedzia makiet (P24 IU-4). Ramki strony narzedzia laduja aplikacje przez proxy, wiec proxy zdejmuje
// wylacznie zakaz osadzania: `X-Frame-Options`, dyrektywe `frame-ancestors` z kazdej polityki CSP (takze `-Report-Only`)
// i `Strict-Transport-Security` (origin proxy to http://127.0.0.1). Reszta CSP zostaje — smoke dalej widzi prawdziwe bledy CSP.
// `frame-ancestors` w `<meta>` przegladarki ignoruja, wiec wystarcza naglowki HTTP.
//
// Proxy to origin aplikacji dla przegladarki: `Location` absolutne na cel wraca na origin proxy, `Set-Cookie` bez `Domain`
// i `Secure` (http), `SameSite=None` bez `Secure` przegladarka odrzuca — zamiana na `Lax` (ramki sa same-origin ze strona).
// Naglowki hop-by-hop (RFC 9110 §7.6.1 i wymienione w `Connection`) nie przechodza w zadnym kierunku.

const HOP_BY_HOP = ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade']
const ZDEJMOWANE = ['x-frame-options', 'strict-transport-security']
const POLITYKI_CSP = ['content-security-policy', 'content-security-policy-report-only']

/**
 * @typedef {Record<string, string | string[] | undefined>} Naglowki
 * @typedef {{ cel: string, proxy: string }} Adresy originy aplikacji i proxy
 */

/**
 * CSP bez dyrektywy `frame-ancestors` (pierwszy token, bez wzgledu na wielkosc liter) w kazdej polityce listy.
 * @param {string} csp wartosc naglowka; polityki po `,`, dyrektywy po `;`
 * @returns {string | null} null, gdy nie zostala zadna niepusta polityka
 */
export function bezFrameAncestors(csp) {
  const polityki = csp.split(',').map((polityka) => polityka.split(';').map((d) => d.trim())
    .filter((d) => d && d.split(/\s+/)[0].toLowerCase() !== 'frame-ancestors').join('; ')).filter(Boolean)
  return polityki.length ? polityki.join(', ') : null
}

/** @param {Naglowki} naglowki @param {{ upgrade?: boolean }} opcje @returns {Set<string>} nazwy do zdjecia jako hop-by-hop */
function hopByHop(naglowki, { upgrade = false } = {}) {
  const zConnection = String(naglowki.connection ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
  const nazwy = new Set([...HOP_BY_HOP, ...zConnection])
  // Uzgodnienie WebSocketu potrzebuje `Connection: Upgrade` i `Upgrade` do celu — reszta hop-by-hop i tak odpada.
  if (upgrade) for (const n of ['connection', 'upgrade']) nazwy.delete(n)
  return nazwy
}

/** @param {string} wartosc @param {Adresy} adresy @returns {string} */
function przepiszLocation(wartosc, adresy) {
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(wartosc)) return wartosc
  try {
    const u = new URL(wartosc)
    return u.origin === new URL(adresy.cel).origin ? `${new URL(adresy.proxy).origin}${u.pathname}${u.search}${u.hash}` : wartosc
  } catch {
    // Niepoprawny adres absolutny — przegladarka i tak go odrzuci; przekazujemy bez zmian, jak aplikacja go wyslala.
    return wartosc
  }
}

/** @param {string} ciasteczko @returns {string} bez atrybutow Domain i Secure, SameSite=None → Lax */
function przepiszCiasteczko(ciasteczko) {
  const [para, ...atrybuty] = ciasteczko.split(';')
  const zostaja = atrybuty.map((a) => a.trim()).filter((a) => a && !/^(domain\s*=|secure$)/i.test(a))
    .map((a) => /^samesite\s*=\s*none$/i.test(a) ? 'SameSite=Lax' : a)
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
    if (wartosc === undefined || pomijane.has(nazwa) || ZDEJMOWANE.includes(nazwa)) continue
    if (POLITYKI_CSP.includes(nazwa)) {
      const csp = bezFrameAncestors([wartosc].flat().join(', '))
      if (csp) wynik[nazwa] = csp
    } else if (nazwa === 'location') wynik[nazwa] = przepiszLocation(String(wartosc), adresy)
    else if (nazwa === 'set-cookie') wynik[nazwa] = [wartosc].flat().map(przepiszCiasteczko)
    else wynik[nazwa] = wartosc
  }
  return wynik
}

/**
 * Naglowki zadania przegladarki do aplikacji: bez hop-by-hop, `Host` = origin proxy (aplikacja widzi swoj `'self'`),
 * `X-Forwarded-Host` i `X-Forwarded-Proto`.
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
  return { ...wynik, host, 'x-forwarded-host': host, 'x-forwarded-proto': 'http' }
}

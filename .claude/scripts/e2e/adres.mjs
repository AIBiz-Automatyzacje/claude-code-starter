// Adresy serwera E2E — wspolne dla rdzenia (srodowisko.mjs) i adaptera stacku (adapter.mjs), zeby adapter nie importowal
// rdzenia, ktory importuje adapter (cykl).

export const HOSTY_LOKALNE = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0']

/** @param {string} url @returns {URL | null} adres http(s) albo null (zapis bez schematu parsuje sie jako schemat `localhost:`) */
export function adresHttp(url) {
  const u = URL.canParse(url) ? new URL(url) : null
  return u && (u.protocol === 'http:' || u.protocol === 'https:') ? u : null
}

/** @param {URL} a @param {URL} b @returns {boolean} ten sam serwer: port i host (localhost, 127.0.0.1, [::1] to jeden host) */
export function tenSamSerwer(a, b) {
  const host = (/** @type {URL} */ u) => (HOSTY_LOKALNE.includes(u.hostname) ? 'lokalny' : u.hostname)
  return a.protocol === b.protocol && a.port === b.port && host(a) === host(b)
}

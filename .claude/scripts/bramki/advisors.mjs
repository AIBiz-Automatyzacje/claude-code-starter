// Advisors Supabase: lint bazy (bezpieczenstwo i wydajnosc) przez Management API na projekcie chmurowym — bez Dockera.
// ERROR = porazka (trafienia), WARN = ostrzezenie, INFO pominiety. Token idzie tylko w naglowku, nigdy do wyniku.
// Wola go `e2e.mjs advisors` po wgraniu migracji fazy na baze e2e (P17): przy domknieciu fazy migracje nie sa jeszcze
// w zadnej bazie, a baza podlinkowana (dev) dostaje je dopiero od operatora — lint pokazywal stary stan (vibersi, 6a pkt 80).

export const API_SUPABASE = 'https://api.supabase.com'
const RODZAJE = ['security', 'performance']
const SUFIT_MS = 30_000

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {{ name: string, title: string, level: 'ERROR' | 'WARN' | 'INFO', detail?: string }} Lint */

/** @param {Lint} l */
const trafienie = (l) => ({ plik: null, linia: null, regula: `advisors/${l.name}`, opis: `${l.title}: ${l.detail ?? ''}` })

/**
 * @param {string} ref ref projektu Supabase
 * @param {string} token token Management API (SUPABASE_ACCESS_TOKEN)
 * @param {string} bazaApi adres Management API
 * @returns {Promise<WynikBramki>}
 */
export async function advisorsProjektu(ref, token, bazaApi) {
  const start = performance.now()
  /** @type {Lint[]} */
  const linty = []
  try {
    for (const rodzaj of RODZAJE) {
      const odp = await fetch(`${bazaApi}/v1/projects/${ref}/advisors/${rodzaj}`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(SUFIT_MS),
      })
      if (!odp.ok) return { status: 'blad', sekundy: null, trafienia: [], powod: `advisors/${rodzaj}: HTTP ${odp.status}` }
      const dane = await odp.json()
      linty.push(...dane.lints)
    }
  } catch (e) {
    const sieciowy = e instanceof TypeError || (e instanceof DOMException && e.name === 'TimeoutError')
    if (!sieciowy) throw e
    return { status: 'blad', sekundy: null, trafienia: [], powod: `advisors: ${e.message}` }
  }
  const sekundy = Math.round((performance.now() - start) / 100) / 10
  const trafienia = linty.filter((l) => l.level === 'ERROR').map(trafienie)
  const ostrzezenia = linty.filter((l) => l.level === 'WARN').map(trafienie)
  return { status: trafienia.length ? 'porazka' : 'ok', sekundy, trafienia, ostrzezenia }
}

// Bramka advisors: lint bazy Supabase (bezpieczenstwo i wydajnosc) przez Management API na projekcie chmurowym — bez Dockera.
// Token z SUPABASE_ACCESS_TOKEN, ref z SUPABASE_PROJECT_REF albo supabase/.temp/project-ref (`supabase link`); brak = status brak.
// ERROR = porazka, WARN = ostrzezenie, INFO pominiety. Token idzie tylko w naglowku, nigdy do wyniku.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const API_SUPABASE = 'https://api.supabase.com'
const RODZAJE = ['security', 'performance']
const SUFIT_MS = 30_000

/** @typedef {import('./uruchom.mjs').WynikBramki} WynikBramki */
/** @typedef {{ name: string, title: string, level: 'ERROR' | 'WARN' | 'INFO', detail?: string }} Lint */

/** @param {string} projekt @param {Record<string, string | undefined>} env @returns {string} */
function refProjektu(projekt, env) {
  if (env.SUPABASE_PROJECT_REF) return env.SUPABASE_PROJECT_REF
  const plik = join(projekt, 'supabase', '.temp', 'project-ref')
  return existsSync(plik) ? readFileSync(plik, 'utf8').trim() : ''
}

/** @param {Lint} l */
const trafienie = (l) => ({ plik: null, linia: null, regula: `advisors/${l.name}`, opis: `${l.title}: ${l.detail ?? ''}` })

/**
 * @param {string} projekt
 * @param {Record<string, string | undefined>} env zmienne srodowiska (process.env)
 * @param {string} bazaApi adres Management API
 * @returns {Promise<WynikBramki>}
 */
export async function bramkaAdvisors(projekt, env, bazaApi) {
  if (!existsSync(join(projekt, 'supabase'))) return { status: 'pominieta', sekundy: null, trafienia: [], powod: 'projekt bez katalogu supabase/' }
  const token = env.SUPABASE_ACCESS_TOKEN
  if (!token) return { status: 'brak', sekundy: null, trafienia: [], powod: 'brak SUPABASE_ACCESS_TOKEN (token Management API)' }
  const ref = refProjektu(projekt, env)
  if (!ref) return { status: 'brak', sekundy: null, trafienia: [], powod: 'brak ref projektu (SUPABASE_PROJECT_REF albo supabase link)' }
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

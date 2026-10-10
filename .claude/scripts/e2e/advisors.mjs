// Advisors na bazie e2e po wgraniu migracji fazy (P17). Wola go agent db-sync autopilota (`e2e.mjs advisors --baza <sha>`),
// wynik idzie do reviewera security jako wejscie. Wczesniej bramka domkniecia sprawdzala baze podlinkowana (dev), zanim
// migracje fazy trafily do jakiejkolwiek bazy, a bez tokenu milczala statusem `brak` (vibersi etap 1, 6a pkt 80).
//
// Ref: SUPABASE_E2E_PROJECT_REF z .env.e2e albo host VITE_SUPABASE_URL (`<ref>.supabase.co`). Token: SUPABASE_ACCESS_TOKEN
// ze srodowiska albo z .env.e2e (plik w .gitignore, sekrety e2e). Statusy: ok / porazka (lint ERROR) / blad (API) /
// brak (bez tokenu albo ref — z naprawa) / pominieta (bez .env.e2e albo faza bez migracji).

import { spawnSync } from 'node:child_process'

import { advisorsProjektu, API_SUPABASE } from '../bramki/advisors.mjs'
import { envE2e, PLIK_ENV } from './srodowisko.mjs'

export const KLUCZ_TOKENU = 'SUPABASE_ACCESS_TOKEN'
const KATALOG_MIGRACJI = 'supabase/migrations'
const HOST_SUPABASE = /^([a-z0-9]{20})\.supabase\.(?:co|in)$/

/**
 * @typedef {{ status: 'ok' | 'porazka' | 'blad' | 'brak' | 'pominieta', ref: string | null, sekundy: number | null,
 *   bledy: import('../bramki/uruchom.mjs').Trafienie[], ostrzezenia: import('../bramki/uruchom.mjs').Trafienie[], detal: string, naprawa: string }} WynikAdvisors
 */

/** @param {Record<string, string>} env zawartosc .env.e2e @returns {string | null} ref projektu Supabase e2e */
export function refE2e(env) {
  if (env.SUPABASE_E2E_PROJECT_REF) return env.SUPABASE_E2E_PROJECT_REF
  const url = env.VITE_SUPABASE_URL
  const host = url && URL.canParse(url) ? new URL(url).hostname : ''
  return HOST_SUPABASE.exec(host)?.[1] ?? null
}

/**
 * @param {Record<string, string>} env zawartosc .env.e2e
 * @param {Record<string, string | undefined>} srodowisko zmienne procesu
 * @returns {string | null}
 */
export const tokenAdvisors = (env, srodowisko) => srodowisko[KLUCZ_TOKENU] || env[KLUCZ_TOKENU] || null

/**
 * Czy advisors pobiegnie po migracjach fazy — dla doctora i bramki gotowosci /dev-plan (P17: w vibersi bramka milczala
 * statusem `brak` przez dwie fazy z migracjami, a nikt przed runem nie wiedzial o brakujacym tokenie).
 * @param {string} projekt
 * @param {Record<string, string | undefined>} [srodowisko]
 * @returns {{ gotowe: boolean, ref: string | null, uwaga: string }}
 */
export function gotowoscAdvisors(projekt, srodowisko = process.env) {
  const env = envE2e(projekt)
  if (!env) return { gotowe: false, ref: null, uwaga: `advisors nie pobiegnie: brak ${PLIK_ENV} (lint biegnie na bazie e2e po wgraniu migracji fazy) — .claude/templates/e2e-env/README.md` }
  const ref = refE2e(env)
  if (!ref) return { gotowe: false, ref: null, uwaga: `advisors nie pobiegnie: VITE_SUPABASE_URL w ${PLIK_ENV} bez postaci https://<ref>.supabase.co — dopisz SUPABASE_E2E_PROJECT_REF` }
  if (!tokenAdvisors(env, srodowisko)) {
    return { gotowe: false, ref, uwaga: `advisors nie pobiegnie: brak ${KLUCZ_TOKENU} — Supabase → Account → Access Tokens, wpis ${KLUCZ_TOKENU}=<token> w ${PLIK_ENV}` }
  }
  return { gotowe: true, ref, uwaga: '' }
}

/** @param {string} projekt @param {string} baza @returns {boolean | null} czy faza zmienila migracje; null = git nie odpowiedzial */
function fazaZMigracjami(projekt, baza) {
  const w = spawnSync('git', ['diff', '--name-only', baza, 'HEAD', '--', KATALOG_MIGRACJI], { cwd: projekt, encoding: 'utf8' })
  return w.status === 0 ? w.stdout.trim().length > 0 : null
}

/** @param {Partial<WynikAdvisors>} pola @returns {WynikAdvisors} */
const wynik = (pola) => ({ status: 'pominieta', ref: null, sekundy: null, bledy: [], ostrzezenia: [], detal: '', naprawa: '', ...pola })

/**
 * @param {string} projekt
 * @param {{ baza?: string, bazaApi?: string, srodowisko?: Record<string, string | undefined> }} opcje baza: commit sprzed fazy
 *   (bez niego advisors biegnie zawsze — wznowiona faza bez bazy w stanie)
 * @returns {Promise<WynikAdvisors>}
 */
export async function advisorsE2e(projekt, { baza, bazaApi = API_SUPABASE, srodowisko = process.env } = {}) {
  const env = envE2e(projekt)
  if (!env) return wynik({ detal: `brak ${PLIK_ENV} — advisors sprawdza tylko baze e2e (migracje fazy wgrywa tam db-sync)` })
  if (baza && fazaZMigracjami(projekt, baza) === false) return wynik({ detal: `faza nie zmienila ${KATALOG_MIGRACJI}/ — lint bazy bez zmian` })
  const ref = refE2e(env)
  if (!ref) {
    return wynik({ status: 'brak', detal: `brak ref projektu e2e: VITE_SUPABASE_URL w ${PLIK_ENV} nie ma postaci https://<ref>.supabase.co`, naprawa: `dopisz SUPABASE_E2E_PROJECT_REF=<ref> do ${PLIK_ENV}` })
  }
  const token = tokenAdvisors(env, srodowisko)
  if (!token) {
    return wynik({
      status: 'brak', ref,
      detal: `brak ${KLUCZ_TOKENU} — lint bazy e2e (RLS, search_path, indeksy) nie biegnie, security sprawdza migracje recznie`,
      naprawa: `Supabase → Account → Access Tokens → Generate new token; dopisz ${KLUCZ_TOKENU}=<token> do ${PLIK_ENV} (plik w .gitignore). Token daje dostep do calego konta Supabase.`,
    })
  }
  const w = await advisorsProjektu(ref, token, bazaApi)
  const status = w.status === 'ok' || w.status === 'porazka' ? w.status : 'blad'
  const detal = status === 'blad' ? w.powod ?? 'blad API' : `${w.trafienia.length} bledow (ERROR), ${w.ostrzezenia?.length ?? 0} ostrzezen (WARN)`
  return wynik({ status, ref, sekundy: w.sekundy, bledy: w.trafienia, ostrzezenia: w.ostrzezenia ?? [], detal })
}

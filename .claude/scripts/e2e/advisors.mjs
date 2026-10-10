// Advisors na bazie e2e po wgraniu migracji fazy (P17). Wola go agent db-sync autopilota (`e2e.mjs advisors --baza <sha>`),
// wynik idzie do reviewera security jako wejscie. Wczesniej bramka domkniecia sprawdzala baze podlinkowana (dev), zanim
// migracje fazy trafily do jakiejkolwiek bazy, a bez tokenu milczala statusem `brak` (vibersi etap 1, 6a pkt 80).
//
// Ref: SUPABASE_E2E_PROJECT_REF z .env.e2e, inaczej projekt bazy, do ktorej db-sync wgrywa migracje (SUPABASE_E2E_DB_URL:
// uzytkownik poolera `postgres.<ref>` albo host `db.<ref>.supabase.co`), inaczej host VITE_SUPABASE_URL; rozne projekty w obu
// adresach = brak (lint innej bazy niz ta z migracjami). Token: SUPABASE_ACCESS_TOKEN z .env.e2e, inaczej ze srodowiska —
// token projektu wygrywa z ogolnym z powloki (projekt e2e na innym koncie). ~/.zshrc nie dociera do agentow (powloka
// nieinteraktywna, vibersi etap 1), wiec .env.e2e jest miejscem domyslnym. Statusy: ok / porazka (lint ERROR) / blad (API) /
// brak (bez tokenu albo ref — z naprawa) / pominieta (bez .env.e2e albo faza bez migracji).

import { spawnSync } from 'node:child_process'

import { advisorsProjektu, API_SUPABASE } from '../bramki/advisors.mjs'
import { envE2e, PLIK_ENV } from './srodowisko.mjs'

export const KLUCZ_TOKENU = 'SUPABASE_ACCESS_TOKEN'
const KATALOG_MIGRACJI = 'supabase/migrations'
const HOST_SUPABASE = /^([a-z0-9]{20})\.supabase\.(?:co|in)$/
const HOST_BAZY = /^db\.([a-z0-9]{20})\.supabase\.(?:co|in)$/
const UZYTKOWNIK_POOLERA = /^postgres\.([a-z0-9]{20})$/

/**
 * @typedef {{ status: 'ok' | 'porazka' | 'blad' | 'brak' | 'pominieta', ref: string | null, sekundy: number | null,
 *   bledy: import('../bramki/uruchom.mjs').Trafienie[], ostrzezenia: import('../bramki/uruchom.mjs').Trafienie[], detal: string, naprawa: string }} WynikAdvisors
 */

/** @param {string | undefined} url @returns {URL | null} */
const adres = (url) => (url && URL.canParse(url) ? new URL(url) : null)

/** @param {string | undefined} dbUrl @returns {string | null} ref projektu z adresu bazy (pooler albo direct) */
function refZBazy(dbUrl) {
  const u = adres(dbUrl)
  if (!u) return null
  return UZYTKOWNIK_POOLERA.exec(decodeURIComponent(u.username))?.[1] ?? HOST_BAZY.exec(u.hostname)?.[1] ?? null
}

/**
 * @param {Record<string, string>} env zawartosc .env.e2e
 * @returns {{ ref: string | null, blad: string | null }} ref projektu Supabase e2e albo powod, ze go nie ustalono
 */
export function refE2e(env) {
  if (env.SUPABASE_E2E_PROJECT_REF) return { ref: env.SUPABASE_E2E_PROJECT_REF, blad: null }
  const zBazy = refZBazy(env.SUPABASE_E2E_DB_URL)
  const zAplikacji = HOST_SUPABASE.exec(adres(env.VITE_SUPABASE_URL)?.hostname ?? '')?.[1] ?? null
  if (zBazy && zAplikacji && zBazy !== zAplikacji) {
    return { ref: null, blad: `SUPABASE_E2E_DB_URL (${zBazy}) i VITE_SUPABASE_URL (${zAplikacji}) wskazuja rozne projekty — dopisz SUPABASE_E2E_PROJECT_REF projektu, do ktorego db-sync wgrywa migracje` }
  }
  const ref = zBazy ?? zAplikacji
  return ref ? { ref, blad: null } : { ref: null, blad: `brak ref projektu e2e: ani SUPABASE_E2E_DB_URL, ani VITE_SUPABASE_URL w ${PLIK_ENV} nie wskazuje projektu Supabase — dopisz SUPABASE_E2E_PROJECT_REF` }
}

/**
 * @param {Record<string, string>} env zawartosc .env.e2e
 * @param {Record<string, string | undefined>} srodowisko zmienne procesu
 * @returns {string | null}
 */
export const tokenAdvisors = (env, srodowisko) => env[KLUCZ_TOKENU] || srodowisko[KLUCZ_TOKENU] || null

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
  const { ref, blad } = refE2e(env)
  if (!ref) return { gotowe: false, ref: null, uwaga: `advisors nie pobiegnie: ${blad}` }
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
  const { ref, blad } = refE2e(env)
  if (!ref) return wynik({ status: 'brak', detal: blad ?? 'brak ref projektu e2e', naprawa: `dopisz SUPABASE_E2E_PROJECT_REF=<ref> do ${PLIK_ENV}` })
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

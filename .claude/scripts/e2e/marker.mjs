// Marker bazy e2e (README e2e-env, „Pozytywna identyfikacja bazy”): seedy, ktore zaczynaja sie od guardu
// `to_regclass('public.e2e_env_marker')`, odmawiaja pracy na bazie bez tej tabeli. Bez sprawdzenia na starcie srodowisko
// wychodzilo „gotowe” (canary loguje sie bez seeda), a kazdy scenariusz padal dopiero na seedzie i schodzil na [Manual]
// (pilot Nawykometr, run 1: 0 PASS, zadanie zarchiwizowane). Sprawdzenie biegnie tylko, gdy seedy projektu maja ten guard.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PROFIL } from '../stack/profil.mjs'

export const TABELA_MARKERA = 'public.e2e_env_marker'
const NAZWA_MARKERA = 'e2e_env_marker'
const LIMIT_MS = 15_000

/** @param {string} projekt @returns {string[]} nazwy seedow (katalog seedow profilu stacku) z guardem markera */
export function seedyZMarkerem(projekt) {
  const katalog = join(projekt, PROFIL.e2e.katalogSeedow)
  if (!existsSync(katalog)) return []
  return readdirSync(katalog)
    .filter((plik) => plik.endsWith('.sql') && readFileSync(join(katalog, plik), 'utf8').includes(NAZWA_MARKERA))
    .sort()
}

/**
 * Zmienne libpq z adresu bazy: haslo idzie w srodowisku procesu psql, nie w argumentach (widac je w `ps`).
 * @param {string} adres postgresql://uzytkownik:haslo@host:port/baza?sslmode=…
 * @returns {Record<string, string> | null} null, gdy adres nie jest URL-em postgresql
 */
export function zmiennePolaczenia(adres) {
  let url
  try {
    url = new URL(adres)
  } catch {
    return null
  }
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) return null
  /** @type {Record<string, string>} */
  const zmienne = {
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)) || 'postgres',
  }
  const ssl = url.searchParams.get('sslmode')
  if (ssl) zmienne.PGSSLMODE = ssl
  return zmienne
}

/**
 * Czy baza e2e ma tabele markera. ok: marker jest; inaczej detal mowi, czego brak (tabeli, psql, polaczenia).
 * @param {string} adres SUPABASE_E2E_DB_URL
 * @returns {{ ok: boolean, detal: string }}
 */
export function markerBazy(adres) {
  const zmienne = zmiennePolaczenia(adres)
  if (!zmienne) return { ok: false, detal: 'SUPABASE_E2E_DB_URL nie jest adresem postgresql:// — nie da sie sprawdzic markera' }
  const w = spawnSync('psql', ['-tAX', '-v', 'ON_ERROR_STOP=1', '-c', `select to_regclass('${TABELA_MARKERA}') is not null`], {
    encoding: 'utf8', timeout: LIMIT_MS, env: { ...process.env, ...zmienne },
  })
  if (w.error) return { ok: false, detal: `psql nie ruszyl (${w.error.message}) — seedy tez go potrzebuja` }
  if (w.status !== 0) return { ok: false, detal: `psql kod ${w.status}: ${(w.stderr || '').trim().split('\n')[0]}` }
  return w.stdout.trim() === 't' ? { ok: true, detal: `${TABELA_MARKERA} jest` } : { ok: false, detal: `brak tabeli ${TABELA_MARKERA}` }
}

// Srodowisko E2E projektu (P14): parametry z `.env.e2e`, sprawdzenie przed startem autopilota (sekcja Doctor) oraz start
// serwera aplikacji (proces serwera: serwer.mjs). Wczesniej ten przepis byl rozsiany po promptach env-up, env-down i testera
// (Vite, port 5173, Supabase na sztywno); projekt z innym serwerem albo bez Supabase nie mial jak z niego skorzystac.
// To, co zalezy od stacku (domyslny port i komenda startu, narzedzie jazdy testera, probny zrzut), daje adapter.mjs.
//
// Parametry `.env.e2e` (wszystkie opcjonalne, domyslne z adaptera stacku):
//   E2E_URL            adres aplikacji (domyslnie http://localhost:<DOMYSLNY_PORT adaptera>)
//   E2E_START          komenda startu (domyslnie komendaStartu adaptera)
//   E2E_HEALTH         adres sondy zdrowia (domyslnie E2E_URL ze sciezka SCIEZKA_ZDROWIA adaptera; odpowiedz < 500 = dziala)
//   E2E_HEALTH_TRESC   tekst, ktory musi byc w odpowiedzi sondy (P25 A2: aplikacja z serwerem API — trasa zdrowia serwera
//                      zamiast strony, bo fallback SPA odpowiada 200 na kazdej sciezce)
//   E2E_START_TIMEOUT  sekundy na start (domyslnie 90)
// Baza e2e (projekt z katalogiem supabase/ albo z kluczami SUPABASE_E2E_*): wymagane KLUCZE_BAZY i guard tozsamosci.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { bramkaMigrationsSum } from '../bramki/migrations-sum.mjs'
import { adresHttp, HOSTY_LOKALNE } from './adres.mjs'
import { markerBazy, seedyZMarkerem, TABELA_MARKERA } from './marker.mjs'
import { PROFIL } from '../stack/profil.mjs'
import { DOMYSLNY_PORT, komendaStartu, NARZEDZIE_JAZDY, probnyZrzut, SCIEZKA_ZDROWIA, sprawdzNarzedzie } from './adapter.mjs'

export const PLIK_ENV = '.env.e2e'
// Klucze bazy e2e; grupa = zamienniki. Klucz klienta: publishable (sb_publishable_…) albo legacy anon, ktory Supabase
// wycofuje do konca 2026 — projekt z nowymi kluczami dostawal STOP na starcie mimo kompletnego .env.e2e. Klucze klienta
// (adres i klucz Supabase z prefiksem publicznym stacku) daje profil stacku.
const { env: ENV_STACKU } = PROFIL
export const KLUCZE_BAZY = [[ENV_STACKU.adresSupabase], ENV_STACKU.kluczSupabase, ['SUPABASE_E2E_DB_URL'],
  ['SUPABASE_E2E_SERVICE_ROLE_KEY'], ['E2E_TEST_EMAIL'], ['E2E_TEST_PASSWORD']]
const LIMIT_STARTU_SEK = 90
// Agent startu uruchamia skrypt Bashem z limitem 600 s — start musi skonczyc sie wczesniej, inaczej Bash ubija skrypt
// z serwerem w tle, ale bez wyniku JSON.
// Przed startem serwera biegnie probny zrzut (do 30 s) i zamkniecie jego sesji (do 10 s) — zapas 60 s do limitu Basha.
const MAKS_STARTU_SEK = 500

/**
 * @typedef {{ url: string, zdrowie: string, zdrowieTresc: string | null, port: number, lokalny: boolean, start: string, limitSek: number, log: string, pid: string,
 *   bazaE2e: boolean, odcisk: string, blad: string | null }} Konfiguracja
 * @typedef {{ ok: boolean, detal: string }} WynikNarzedzia
 * @typedef {{ czyIgnorowany: (projekt: string, plik: string) => boolean, narzedzieJazdy: () => WynikNarzedzia, zrzut?: () => WynikNarzedzia,
 *   markerBazy?: (adres: string) => WynikNarzedzia }} Narzedzia
 */

/** @param {string} tresc @returns {Record<string, string>} */
export function parsujEnv(tresc) {
  /** @type {Record<string, string>} */
  const env = {}
  for (const linia of tresc.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(linia)
    if (!m || linia.trimStart().startsWith('#')) continue
    const cytat = /^(['"])(.*?)\1(?:\s+#.*)?$/.exec(m[2])
    env[m[1]] = cytat ? cytat[2] : m[2].replace(/\s+#.*$/, '')
  }
  return env
}

/** @param {string} projekt @param {string} plik @returns {Record<string, string> | null} */
function wczytajEnv(projekt, plik) {
  const sciezka = join(projekt, plik)
  return existsSync(sciezka) ? parsujEnv(readFileSync(sciezka, 'utf8')) : null
}

/** @param {string} projekt @returns {string} menedzer pakietow z lockfile */
export function menedzerPakietow(projekt) {
  if (existsSync(join(projekt, 'bun.lockb')) || existsSync(join(projekt, 'bun.lock'))) return 'bun'
  if (existsSync(join(projekt, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(projekt, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

/** @param {string} klucz @param {string} url @returns {string} */
const bladAdresu = (klucz, url) => `${klucz} w ${PLIK_ENV} to „${url}” — podaj pelny adres http(s):// z portem, np. http://localhost:${DOMYSLNY_PORT}`

/**
 * Port z `--port N` w komendzie startu rozny od portu E2E_URL (P19): stary `.env.e2e` z samym `E2E_START ... --port 5173`
 * po zmianie domyslnego E2E_URL na 5174 — serwer wstaje na 5173, sonda pyta 5174 i po limicie startu STOP z bledna przyczyna.
 * @param {string | undefined} start
 * @param {string} port
 * @returns {string | null}
 */
function bladPortuStartu(start, port) {
  const zStartu = start ? /--port[= ](\d+)/.exec(start)?.[1] : undefined
  if (!zStartu || zStartu === port) return null
  return `E2E_START uruchamia serwer na porcie ${zStartu}, a E2E_URL wskazuje port ${port} — ustaw w ${PLIK_ENV} E2E_URL=http://localhost:${zStartu} albo zmien --port w E2E_START na ${port}`
}

/** @param {string} url @returns {string} adres do porownania baz (origin; ukosnik na koncu bez znaczenia) */
const originBazy = (url) => adresHttp(url.trim())?.origin ?? url.trim()

/**
 * @param {string} projekt
 * @param {Record<string, string>} env zawartosc .env.e2e
 * @returns {Konfiguracja}
 */
export function konfiguracja(projekt, env) {
  const url = env.E2E_URL || `http://localhost:${DOMYSLNY_PORT}`
  const zdrowie = env.E2E_HEALTH || (SCIEZKA_ZDROWIA ? `${url.replace(/\/$/, '')}${SCIEZKA_ZDROWIA}` : url)
  const nazwa = basename(projekt).replace(/[^A-Za-z0-9_-]/g, '_')
  const adres = adresHttp(url)
  const port = adres ? adres.port || (adres.protocol === 'https:' ? '443' : '80') : String(DOMYSLNY_PORT)
  const blad = !adres ? bladAdresu('E2E_URL', url) : !adresHttp(zdrowie) ? bladAdresu('E2E_HEALTH', zdrowie) : bladPortuStartu(env.E2E_START, port)
  return {
    url,
    zdrowie,
    zdrowieTresc: env.E2E_HEALTH_TRESC || null,
    port: Number(port),
    lokalny: !adres || HOSTY_LOKALNE.includes(adres.hostname),
    start: env.E2E_START || komendaStartu(menedzerPakietow(projekt), port),
    limitSek: Math.min(Number(env.E2E_START_TIMEOUT) > 0 ? Number(env.E2E_START_TIMEOUT) : LIMIT_STARTU_SEK, MAKS_STARTU_SEK),
    log: `/tmp/autopilot-e2e-${nazwa}.log`,
    pid: `/tmp/autopilot-e2e-${nazwa}.pid`,
    bazaE2e: existsSync(join(projekt, 'supabase')) || Object.keys(env).some((k) => k.startsWith('SUPABASE_E2E_')),
    // Odcisk konfiguracji w pliku PID: serwer z poprzedniego runu jest nasz tylko przy tej samej komendzie i tym samym .env.e2e.
    odcisk: createHash('sha256').update(JSON.stringify(Object.entries(env).sort())).digest('hex').slice(0, 16),
    blad,
  }
}

/** @type {Narzedzia} */
export const NARZEDZIA = {
  czyIgnorowany: (projekt, plik) => spawnSync('git', ['check-ignore', '-q', plik], { cwd: projekt }).status === 0,
  narzedzieJazdy: sprawdzNarzedzie,
  zrzut: probnyZrzut,
  markerBazy,
}

/**
 * Sprawdzenie srodowiska bez startu serwera: plik w .gitignore, klucze bazy e2e, guard tozsamosci, suma migracji, narzedzie jazdy.
 * Kazdy blad niesie wlasna naprawe — trafia 1:1 do STOP-u autopilota.
 * @param {string} projekt
 * @param {Record<string, string>} env
 * @param {{ jazda: boolean, narzedzia?: Narzedzia }} opcje jazda: czy zadanie potrzebuje narzedzia jazdy testera
 * @returns {string[]}
 */
export function bledySrodowiska(projekt, env, { jazda, narzedzia = NARZEDZIA }) {
  const konf = konfiguracja(projekt, env)
  const bledy = []
  if (!narzedzia.czyIgnorowany(projekt, PLIK_ENV)) bledy.push(`${PLIK_ENV} nie jest w .gitignore — dopisz go (plik zawiera sekrety)`)
  if (konf.blad) bledy.push(konf.blad)
  // Guard tozsamosci niezaleznie od bazy e2e: projekt bez supabase/ tez moze celowac z E2E w baze dev. Brak klucza w .env.e2e
  // przy kluczu w pliku env bazy dev (profil stacku: plikiDev) = aplikacja w trybie e2e doczyta adres z niego, czyli baze dev.
  // Plik plikE2eLokalny ma w trybie e2e najwyzszy priorytet — to jego adres trafia do aplikacji.
  const { adresSupabase, plikiDev, plikE2eLokalny, aplikacjaE2e } = ENV_STACKU
  const dev = plikiDev.map((plik) => wczytajEnv(projekt, plik)).flatMap((e) => (e?.[adresSupabase] ? [originBazy(e[adresSupabase])] : []))
  const lokalny = plikE2eLokalny ? wczytajEnv(projekt, plikE2eLokalny)?.[adresSupabase] : undefined
  const adresE2e = lokalny || env[adresSupabase]
  const zrodlo = lokalny ? plikE2eLokalny : PLIK_ENV
  if (dev.length && !adresE2e) {
    bledy.push(`brak ${adresSupabase} w ${PLIK_ENV}, a ${plikiDev.join(' / ')} go ma — ${aplikacjaE2e} doczyta baze dev; ustaw adres dedykowanego projektu Supabase e2e`)
  } else if (adresE2e && dev.includes(originBazy(adresE2e))) {
    bledy.push(`${adresSupabase} w ${zrodlo} jest taki sam jak w ${plikiDev.join(' / ')} — E2E potrzebuje dedykowanego projektu Supabase e2e (ochrona bazy dev/prod)`)
  }
  if (konf.bazaE2e) {
    const braki = KLUCZE_BAZY.filter((grupa) => !grupa.some((k) => env[k])).map(([k, ...legacy]) => (legacy.length ? `${k} (albo legacy ${legacy.join(', ')})` : k))
    if (braki.length) bledy.push(`brak kluczy bazy e2e w ${PLIK_ENV}: ${braki.join(', ')} — szablon: .claude/templates/e2e-env/README.md`)
    const marker = braki.length ? null : bladMarkera(projekt, env, narzedzia)
    if (marker) bledy.push(marker)
    const suma = bramkaMigrationsSum(projekt)
    if (suma.status === 'porazka') bledy.push(`migrations.sum: ${suma.trafienia.map((t) => `${t.plik} — ${t.opis}`).join('; ')} — wypchnieta migracja nie moze trafic do bazy e2e`)
  }
  if (jazda) {
    const { nazwa, instalacja, diagnoza } = NARZEDZIE_JAZDY
    const wynik = narzedzia.narzedzieJazdy()
    if (!wynik.ok) bledy.push(`${nazwa} nie dziala: ${wynik.detal} — instalacja: ${instalacja}; diagnoza: ${diagnoza}`)
  }
  return bledy
}

/**
 * Seedy z guardem markera (README e2e-env, „Pozytywna identyfikacja bazy”) wymagaja tabeli markera na bazie e2e. Bez niej kazdy
 * seed odmawia pracy, a scenariusze schodzily w runie na [Manual] zamiast STOP-u na starcie (pilot Nawykometr, run 1).
 * @param {string} projekt @param {Record<string, string>} env @param {Narzedzia} narzedzia
 * @returns {string | null} blad do STOP-u albo null
 */
function bladMarkera(projekt, env, narzedzia) {
  const seedy = seedyZMarkerem(projekt)
  const sprawdz = narzedzia.markerBazy ?? NARZEDZIA.markerBazy
  if (!seedy.length || !sprawdz) return null
  const wynik = sprawdz(env.SUPABASE_E2E_DB_URL)
  if (wynik.ok) return null
  return `baza e2e: ${wynik.detal} — ${seedy.length} seedow (np. ${PROFIL.e2e.katalogSeedow}/${seedy[0]}) ma guard ${TABELA_MARKERA} i odmowi pracy; `
    + `zaloz tabele markera WYLACZNIE na bazie e2e, nigdy na dev ani prod (.claude/templates/e2e-env/README.md, „Pozytywna identyfikacja bazy”)`
}

/** @param {string} projekt @returns {Record<string, string> | null} zawartosc .env.e2e albo null */
export function envE2e(projekt) {
  return wczytajEnv(projekt, PLIK_ENV)
}

// Srodowisko E2E projektu (P14): parametry z `.env.e2e`, sprawdzenie przed startem autopilota (sekcja Doctor) oraz start
// serwera aplikacji (proces serwera: serwer.mjs). Wczesniej ten przepis byl rozsiany po promptach env-up, env-down i testera
// (Vite, port 5173, Supabase na sztywno); projekt z innym serwerem albo bez Supabase nie mial jak z niego skorzystac.
//
// Parametry `.env.e2e` (wszystkie opcjonalne, domyslne = dev server Vite):
//   E2E_URL            adres aplikacji (domyslnie http://localhost:5173)
//   E2E_START          komenda startu (domyslnie `<pm> run dev -- --mode e2e --port <port> --strictPort`)
//   E2E_HEALTH         adres sondy zdrowia (domyslnie E2E_URL; odpowiedz < 500 = dziala)
//   E2E_START_TIMEOUT  sekundy na start (domyslnie 90)
// Baza e2e (projekt z katalogiem supabase/ albo z kluczami SUPABASE_E2E_*): wymagane KLUCZE_BAZY i guard tozsamosci.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { bramkaMigrationsSum } from '../bramki/migrations-sum.mjs'

export const PLIK_ENV = '.env.e2e'
export const KLUCZE_BAZY = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_E2E_DB_URL', 'SUPABASE_E2E_SERVICE_ROLE_KEY', 'E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD']
const DOMYSLNY_PORT = 5173
const LIMIT_STARTU_SEK = 90
// Agent startu uruchamia skrypt Bashem z limitem 600 s — start musi skonczyc sie wczesniej, inaczej Bash ubija skrypt
// z serwerem w tle, ale bez wyniku JSON.
const MAKS_STARTU_SEK = 540

/**
 * @typedef {{ url: string, zdrowie: string, start: string, limitSek: number, log: string, pid: string, bazaE2e: boolean,
 *   odcisk: string, blad: string | null }} Konfiguracja
 * @typedef {{ czyIgnorowany: (projekt: string, plik: string) => boolean, agentBrowser: () => { ok: boolean, detal: string } }} Narzedzia
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

/** @param {string} url @returns {URL | null} adres http(s) albo null (zapis bez schematu parsuje sie jako schemat `localhost:`) */
function adresHttp(url) {
  const u = URL.canParse(url) ? new URL(url) : null
  return u && (u.protocol === 'http:' || u.protocol === 'https:') ? u : null
}

/** @param {string} klucz @param {string} url @returns {string} */
const bladAdresu = (klucz, url) => `${klucz} w ${PLIK_ENV} to „${url}” — podaj pelny adres http(s):// z portem, np. http://localhost:5173`

/** @param {string} url @returns {string} adres do porownania baz (origin; ukosnik na koncu bez znaczenia) */
const originBazy = (url) => adresHttp(url.trim())?.origin ?? url.trim()

/**
 * @param {string} projekt
 * @param {Record<string, string>} env zawartosc .env.e2e
 * @returns {Konfiguracja}
 */
export function konfiguracja(projekt, env) {
  const url = env.E2E_URL || `http://localhost:${DOMYSLNY_PORT}`
  const zdrowie = env.E2E_HEALTH || url
  const nazwa = basename(projekt).replace(/[^A-Za-z0-9_-]/g, '_')
  const adres = adresHttp(url)
  const port = adres ? adres.port || (adres.protocol === 'https:' ? '443' : '80') : String(DOMYSLNY_PORT)
  const blad = !adres ? bladAdresu('E2E_URL', url) : !adresHttp(zdrowie) ? bladAdresu('E2E_HEALTH', zdrowie) : null
  return {
    url,
    zdrowie,
    start: env.E2E_START || `${menedzerPakietow(projekt)} run dev -- --mode e2e --port ${port} --strictPort`,
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
  agentBrowser: () => {
    const w = spawnSync('agent-browser', ['doctor', '--offline', '--quick'], { encoding: 'utf8' })
    if (w.error) return { ok: false, detal: `brak agent-browser (${w.error.message})` }
    return { ok: w.status === 0, detal: (w.stdout || '').split('\n').filter((l) => /\bfail\b/.test(l)).join('; ') || `kod ${w.status}` }
  },
}

/**
 * Sprawdzenie srodowiska bez startu serwera: plik w .gitignore, klucze bazy e2e, guard tozsamosci, suma migracji, agent-browser.
 * Kazdy blad niesie wlasna naprawe — trafia 1:1 do STOP-u autopilota.
 * @param {string} projekt
 * @param {Record<string, string>} env
 * @param {{ przegladarka: boolean, narzedzia?: Narzedzia }} opcje przegladarka: czy zadanie potrzebuje agent-browser
 * @returns {string[]}
 */
export function bledySrodowiska(projekt, env, { przegladarka, narzedzia = NARZEDZIA }) {
  const konf = konfiguracja(projekt, env)
  const bledy = []
  if (!narzedzia.czyIgnorowany(projekt, PLIK_ENV)) bledy.push(`${PLIK_ENV} nie jest w .gitignore — dopisz go (plik zawiera sekrety)`)
  if (konf.blad) bledy.push(konf.blad)
  // Guard tozsamosci niezaleznie od bazy e2e: projekt bez supabase/ tez moze celowac z E2E w baze dev. Brak klucza w .env.e2e
  // przy kluczu w .env = Vite w trybie e2e doczyta adres z .env, czyli baze dev.
  const dev = [wczytajEnv(projekt, '.env'), wczytajEnv(projekt, '.env.local')].flatMap((e) => (e?.VITE_SUPABASE_URL ? [originBazy(e.VITE_SUPABASE_URL)] : []))
  if (dev.length && !env.VITE_SUPABASE_URL) {
    bledy.push(`brak VITE_SUPABASE_URL w ${PLIK_ENV}, a .env / .env.local go ma — Vite w trybie e2e doczyta baze dev; ustaw adres dedykowanego projektu Supabase e2e`)
  } else if (env.VITE_SUPABASE_URL && dev.includes(originBazy(env.VITE_SUPABASE_URL))) {
    bledy.push(`VITE_SUPABASE_URL w ${PLIK_ENV} jest taki sam jak w .env / .env.local — E2E potrzebuje dedykowanego projektu Supabase e2e (ochrona bazy dev/prod)`)
  }
  if (konf.bazaE2e) {
    const braki = KLUCZE_BAZY.filter((k) => !env[k])
    if (braki.length) bledy.push(`brak kluczy bazy e2e w ${PLIK_ENV}: ${braki.join(', ')} — szablon: .claude/templates/e2e-env/README.md`)
    const suma = bramkaMigrationsSum(projekt)
    if (suma.status === 'porazka') bledy.push(`migrations.sum: ${suma.trafienia.map((t) => `${t.plik} — ${t.opis}`).join('; ')} — wypchnieta migracja nie moze trafic do bazy e2e`)
  }
  if (przegladarka) {
    const ab = narzedzia.agentBrowser()
    if (!ab.ok) bledy.push(`agent-browser nie dziala: ${ab.detal} — instalacja: npm i -g agent-browser && agent-browser install; diagnoza: agent-browser doctor`)
  }
  return bledy
}

/** @param {string} projekt @returns {Record<string, string> | null} zawartosc .env.e2e albo null */
export function envE2e(projekt) {
  return wczytajEnv(projekt, PLIK_ENV)
}

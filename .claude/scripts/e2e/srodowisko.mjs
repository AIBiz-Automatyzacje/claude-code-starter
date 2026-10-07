// Srodowisko E2E projektu (P14): parametry z `.env.e2e`, sprawdzenie przed startem autopilota (sekcja Doctor) oraz start
// i zatrzymanie serwera aplikacji. Wczesniej ten przepis byl rozsiany po promptach env-up, env-down i testera
// (Vite, port 5173, Supabase na sztywno); projekt z innym serwerem albo bez Supabase nie mial jak z niego skorzystac.
//
// Parametry `.env.e2e` (wszystkie opcjonalne, domyslne = dev server Vite):
//   E2E_URL            adres aplikacji (domyslnie http://localhost:5173)
//   E2E_START          komenda startu (domyslnie `<pm> run dev -- --mode e2e --port <port> --strictPort`)
//   E2E_HEALTH         adres sondy zdrowia (domyslnie E2E_URL; odpowiedz < 500 = dziala)
//   E2E_START_TIMEOUT  sekundy na start (domyslnie 90)
// Baza e2e (projekt z katalogiem supabase/ albo z kluczami SUPABASE_E2E_*): wymagane KLUCZE_BAZY i guard tozsamosci.

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { setTimeout as czekaj } from 'node:timers/promises'

import { bramkaMigrationsSum } from '../bramki/migrations-sum.mjs'

export const PLIK_ENV = '.env.e2e'
export const KLUCZE_BAZY = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_E2E_DB_URL', 'SUPABASE_E2E_SERVICE_ROLE_KEY', 'E2E_TEST_EMAIL', 'E2E_TEST_PASSWORD']
const DOMYSLNY_PORT = 5173
const LIMIT_STARTU_SEK = 90
const LIMIT_SONDY_MS = 3000
const ODSTEP_SONDY_MS = 500
const LINIE_OGONA_LOGU = 20

/**
 * @typedef {{ url: string, zdrowie: string, start: string, limitSek: number, log: string, pid: string, bazaE2e: boolean }} Konfiguracja
 * @typedef {{ czyIgnorowany: (projekt: string, plik: string) => boolean, agentBrowser: () => { ok: boolean, detal: string } }} Narzedzia
 */

/** @param {string} tresc @returns {Record<string, string>} */
export function parsujEnv(tresc) {
  /** @type {Record<string, string>} */
  const env = {}
  for (const linia of tresc.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(linia)
    if (!m || linia.trimStart().startsWith('#')) continue
    const surowa = m[2]
    env[m[1]] = /^(['"]).*\1$/.test(surowa) ? surowa.slice(1, -1) : surowa.replace(/\s+#.*$/, '')
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

/** @param {string} url @returns {string} */
function portZUrl(url) {
  const u = new URL(url)
  return u.port || (u.protocol === 'https:' ? '443' : '80')
}

/**
 * @param {string} projekt
 * @param {Record<string, string>} env zawartosc .env.e2e
 * @returns {Konfiguracja}
 */
export function konfiguracja(projekt, env) {
  const url = env.E2E_URL || `http://localhost:${DOMYSLNY_PORT}`
  const nazwa = basename(projekt).replace(/[^A-Za-z0-9_-]/g, '_')
  return {
    url,
    zdrowie: env.E2E_HEALTH || url,
    start: env.E2E_START || `${menedzerPakietow(projekt)} run dev -- --mode e2e --port ${portZUrl(url)} --strictPort`,
    limitSek: Number(env.E2E_START_TIMEOUT) > 0 ? Number(env.E2E_START_TIMEOUT) : LIMIT_STARTU_SEK,
    log: `/tmp/autopilot-e2e-${nazwa}.log`,
    pid: `/tmp/autopilot-e2e-${nazwa}.pid`,
    bazaE2e: existsSync(join(projekt, 'supabase')) || Object.keys(env).some((k) => k.startsWith('SUPABASE_E2E_')),
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
  if (konf.bazaE2e) {
    const braki = KLUCZE_BAZY.filter((k) => !env[k])
    if (braki.length) bledy.push(`brak kluczy bazy e2e w ${PLIK_ENV}: ${braki.join(', ')} — szablon: .claude/templates/e2e-env/README.md`)
    const dev = [wczytajEnv(projekt, '.env'), wczytajEnv(projekt, '.env.local')].filter((e) => e && e.VITE_SUPABASE_URL)
    if (env.VITE_SUPABASE_URL && dev.some((e) => e?.VITE_SUPABASE_URL === env.VITE_SUPABASE_URL)) {
      bledy.push(`VITE_SUPABASE_URL w ${PLIK_ENV} jest taki sam jak w .env / .env.local — E2E potrzebuje dedykowanego projektu Supabase e2e (ochrona bazy dev/prod)`)
    }
    const suma = bramkaMigrationsSum(projekt)
    if (suma.status === 'porazka') bledy.push(`migrations.sum: ${suma.trafienia.map((t) => `${t.plik} — ${t.opis}`).join('; ')} — wypchnieta migracja nie moze trafic do bazy e2e`)
  }
  try {
    portZUrl(konf.url)
  } catch (blad) {
    bledy.push(`E2E_URL w ${PLIK_ENV} nie jest adresem URL (${konf.url}): ${blad instanceof Error ? blad.message : String(blad)}`)
  }
  if (przegladarka) {
    const ab = narzedzia.agentBrowser()
    if (!ab.ok) bledy.push(`agent-browser nie dziala: ${ab.detal} — instalacja: npm i -g agent-browser && agent-browser install; diagnoza: agent-browser doctor`)
  }
  return bledy
}

/** @param {string} url @returns {Promise<boolean>} czy adres odpowiada statusem < 500 (odmowa polaczenia i timeout = nie) */
export async function odpowiada(url) {
  try {
    const odpowiedz = await fetch(url, { signal: AbortSignal.timeout(LIMIT_SONDY_MS), redirect: 'manual' })
    return odpowiedz.status < 500
  } catch {
    // Wynik sondy, nie awaria skryptu: odmowa polaczenia, DNS albo timeout znacza „serwer nie dziala”.
    return false
  }
}

/** @param {string} plik @returns {string} ostatnie linie logu serwera */
function ogonLogu(plik) {
  return existsSync(plik) ? readFileSync(plik, 'utf8').trimEnd().split('\n').slice(-LINIE_OGONA_LOGU).join('\n') : '(brak logu)'
}

/** @param {number} pid */
function zabijGrupe(pid) {
  for (const cel of [-pid, pid]) {
    try {
      process.kill(cel, 'SIGTERM')
      return
    } catch (blad) {
      if (!(blad instanceof Error && 'code' in blad && blad.code === 'ESRCH')) throw blad
    }
  }
}

/**
 * Start serwera aplikacji: zastany (odpowiada przed startem) albo uruchomiony w tle z PID-em w pliku; czeka na sonde zdrowia.
 * @param {string} projekt
 * @param {Konfiguracja} konf
 * @param {Record<string, string>} env doklejane do srodowiska komendy startu
 * @returns {Promise<{ serwer: 'uruchomione' | 'zastane' | 'brak', blad?: string }>}
 */
export async function uruchomSerwer(projekt, konf, env) {
  if (await odpowiada(konf.zdrowie)) return { serwer: 'zastane' }
  const log = openSync(konf.log, 'w')
  const dziecko = spawn(konf.start, { cwd: projekt, shell: true, detached: true, stdio: ['ignore', log, log], env: { ...process.env, ...env } })
  closeSync(log)
  /** @type {number | string | null} */
  let wyjscie = null
  dziecko.on('exit', (kod, sygnal) => { wyjscie = kod ?? sygnal ?? 'nieznany' })
  dziecko.unref()
  if (dziecko.pid === undefined) return { serwer: 'brak', blad: `komenda startu nie wystartowala: ${konf.start}` }
  writeFileSync(konf.pid, String(dziecko.pid))
  const termin = Date.now() + konf.limitSek * 1000
  while (Date.now() < termin) {
    if (await odpowiada(konf.zdrowie)) return { serwer: 'uruchomione' }
    if (wyjscie !== null) {
      rmSync(konf.pid, { force: true })
      return { serwer: 'brak', blad: `komenda startu „${konf.start}” zakonczyla sie (${wyjscie}) przed odpowiedzia ${konf.zdrowie}. Log ${konf.log}:\n${ogonLogu(konf.log)}` }
    }
    await czekaj(ODSTEP_SONDY_MS)
  }
  zabijGrupe(dziecko.pid)
  rmSync(konf.pid, { force: true })
  return { serwer: 'brak', blad: `${konf.zdrowie} nie odpowiada po ${konf.limitSek} s od „${konf.start}” (zajety port, zla komenda albo E2E_START_TIMEOUT za krotki). Log ${konf.log}:\n${ogonLogu(konf.log)}` }
}

/**
 * Zatrzymuje wylacznie serwer uruchomiony przez pipeline (plik PID); zastany zostaje.
 * @param {Konfiguracja} konf
 * @returns {{ posprzatano: boolean, detal: string }}
 */
export function zatrzymajSerwer(konf) {
  if (!existsSync(konf.pid)) return { posprzatano: true, detal: 'brak pliku PID — serwer zastany albo nieuruchomiony, nic do zatrzymania' }
  const pid = Number(readFileSync(konf.pid, 'utf8').trim())
  if (Number.isInteger(pid) && pid > 0) zabijGrupe(pid)
  rmSync(konf.pid, { force: true })
  rmSync(konf.log, { force: true })
  return { posprzatano: true, detal: `zatrzymany serwer PID ${pid}` }
}

/** @param {string} projekt @returns {Record<string, string> | null} zawartosc .env.e2e albo null */
export function envE2e(projekt) {
  return wczytajEnv(projekt, PLIK_ENV)
}

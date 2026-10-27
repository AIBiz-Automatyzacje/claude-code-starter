// Srodowisko E2E projektu (P14): parametry z `.env.e2e`, sprawdzenie przed startem autopilota (sekcja Doctor) oraz start
// serwera aplikacji (proces serwera: serwer.mjs). Wczesniej ten przepis byl rozsiany po promptach env-up, env-down i testera
// (Vite, port 5173, Supabase na sztywno); projekt z innym serwerem albo bez Supabase nie mial jak z niego skorzystac.
//
// Parametry `.env.e2e` (wszystkie opcjonalne, domyslne = dev server Vite):
//   E2E_URL            adres aplikacji (domyslnie http://localhost:5174 — obok domyslnego 5173 dev servera Vite, P19)
//   E2E_START          komenda startu (domyslnie `<pm> run dev -- --mode e2e --port <port> --strictPort`)
//   E2E_HEALTH         adres sondy zdrowia (domyslnie E2E_URL; odpowiedz < 500 = dziala)
//   E2E_HEALTH_TRESC   tekst, ktory musi byc w odpowiedzi sondy (P25 A2: aplikacja z serwerem API — trasa zdrowia serwera
//                      zamiast strony, bo fallback SPA odpowiada 200 na kazdej sciezce)
//   E2E_START_TIMEOUT  sekundy na start (domyslnie 90)
// Baza e2e (projekt z katalogiem supabase/ albo z kluczami SUPABASE_E2E_*): wymagane KLUCZE_BAZY i guard tozsamosci.

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import { bramkaMigrationsSum } from '../bramki/migrations-sum.mjs'

export const PLIK_ENV = '.env.e2e'
// Klucze bazy e2e; grupa = zamienniki. Klucz klienta: publishable (sb_publishable_…) albo legacy anon, ktory Supabase
// wycofuje do konca 2026 — projekt z nowymi kluczami dostawal STOP na starcie mimo kompletnego .env.e2e.
export const KLUCZE_BAZY = [['VITE_SUPABASE_URL'], ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'], ['SUPABASE_E2E_DB_URL'],
  ['SUPABASE_E2E_SERVICE_ROLE_KEY'], ['E2E_TEST_EMAIL'], ['E2E_TEST_PASSWORD']]
// 5174, nie 5173: zwykly `pnpm dev` zajmuje 5173 i start E2E zastawal go jako serwer aplikacji (vibersi etap 2, P19).
export const DOMYSLNY_PORT = 5174
export const PORT_DEV_VITE = 5173
const HOSTY_LOKALNE = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0']
const LIMIT_STARTU_SEK = 90
// Agent startu uruchamia skrypt Bashem z limitem 600 s — start musi skonczyc sie wczesniej, inaczej Bash ubija skrypt
// z serwerem w tle, ale bez wyniku JSON.
// Przed startem serwera biegnie probny zrzut (do 30 s) i zamkniecie jego sesji (do 10 s) — zapas 60 s do limitu Basha.
const MAKS_STARTU_SEK = 500
// Probny zrzut na starcie (P19): vibersi etap 2, faza 6 — `agent-browser screenshot` wisial nawet na about:blank, tester obszedl
// go Playwrightem (971 s). Limit jak w regule testera: zrzut dluzszy niz 30 s = harness niesprawny.
export const LIMIT_ZRZUTU_SEK = 30
const LIMIT_ZAMKNIECIA_MS = 10_000
const SESJA_PROBY = ['--session', 'e2e-proba']

/**
 * @typedef {{ url: string, zdrowie: string, zdrowieTresc: string | null, port: number, lokalny: boolean, start: string, limitSek: number, log: string, pid: string,
 *   bazaE2e: boolean, odcisk: string, blad: string | null }} Konfiguracja
 * @typedef {{ ok: boolean, detal: string }} WynikNarzedzia
 * @typedef {{ czyIgnorowany: (projekt: string, plik: string) => boolean, agentBrowser: () => WynikNarzedzia, zrzut?: () => WynikNarzedzia }} Narzedzia
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

// Uklady repo z serwerem API obok SPA (P27 S1 (12)): `server/` (vibersi), `api/`, monorepo `apps/api/`.
const KATALOGI_SERWERA = ['server', 'api', 'apps/api']
// Czlon nazwy skryptu `server` albo `api` miedzy dwukropkami (`dev:server`, `api:build`), nie fragment slowa (`observer`, `rapid`).
const SKRYPT_SERWERA = /(?:^|:)(?:server|api)(?::|$)/

/** @param {string} projekt @returns {boolean} katalog z KATALOGI_SERWERA albo skrypt package.json z czlonem `server`/`api` (`build:server`, `dev:api`) */
function maSerwerApi(projekt) {
  if (KATALOGI_SERWERA.some((k) => existsSync(join(projekt, k)))) return true
  const pakiet = join(projekt, 'package.json')
  if (!existsSync(pakiet)) return false
  /** @type {unknown} */
  let manifest
  try {
    manifest = JSON.parse(readFileSync(pakiet, 'utf8'))
  } catch (e) {
    // Zly package.json zglasza runner testow (gotowosc.testy); tu tylko brak sygnalu o serwerze, bramka nie pada.
    if (e instanceof SyntaxError) return false
    throw e
  }
  const scripts = manifest && typeof manifest === 'object' && 'scripts' in manifest ? manifest.scripts : null
  return !!scripts && typeof scripts === 'object' && Object.keys(scripts).some((nazwa) => SKRYPT_SERWERA.test(nazwa))
}

/**
 * Uwaga przy planowaniu (P25 A2): aplikacja z serwerem API, a sonda E2E bez E2E_HEALTH_TRESC — sam Vite przechodzi sonde
 * fallbackiem SPA, a zapisy przez /api dostaja w E2E 404 (vibersi etapy 4–5).
 * @param {string} projekt @param {Record<string, string>} env @returns {string | null}
 */
export function uwagaSerweraApi(projekt, env) {
  if (env.E2E_HEALTH_TRESC || !maSerwerApi(projekt)) return null
  return `projekt ma serwer API (server/, api/, apps/api/ albo skrypt *:server, *:api), a sonda E2E nie sprawdza treści — sam Vite odpowiada 200 na każdej ścieżce, więc start bez serwera przejdzie sondę i zapisy przez /api dostaną 404; ustaw E2E_START na skrypt startu obu procesów oraz E2E_HEALTH na trasę zdrowia serwera z E2E_HEALTH_TRESC (.claude/templates/e2e-env/README.md, sekcja „Aplikacja z osobnym serwerem API”)`
}

const PLIKI_VITE = ['vite.config.ts', 'vite.config.mts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs']

/** @param {URL} a @param {URL} b @returns {boolean} ten sam serwer: port i host (localhost, 127.0.0.1, [::1] to jeden host) */
function tenSamSerwer(a, b) {
  const host = (/** @type {URL} */ u) => (HOSTY_LOKALNE.includes(u.hostname) ? 'lokalny' : u.hostname)
  return a.protocol === b.protocol && a.port === b.port && host(a) === host(b)
}

/**
 * Klucze proxy z vite.config (napisy w cudzyslowie z dwukropkiem za nimi, po `proxy:`), bez komentarzy. Klucz z `^` to wyrazenie
 * regularne Vite, pozostale — prefiks sciezki. Proxy z wywolania albo zmiennej (vibersi etap 6a: `proxy: proxySerweraE2e(...)`
 * z tablicy tras) nie ma kluczy w tekscie — kandydatem jest wtedy kazdy napis-sciezka w pliku.
 * @param {string} tresc @returns {string[]}
 */
function kluczeProxy(tresc) {
  const bezKomentarzy = tresc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
  const proxy = /\bproxy\s*:\s*(\{)?/.exec(bezKomentarzy)
  if (!proxy) return []
  if (!proxy[1]) return [...bezKomentarzy.matchAll(/['"`](\^?\/[^'"`\s]*)['"`]/g)].map((m) => m[1])
  return [...bezKomentarzy.slice(proxy.index).matchAll(/['"`](\^?\/[^'"`\s]*)['"`]\s*:/g)].map((m) => m[1])
}

/** @param {string} klucz @param {string} sciezka @returns {boolean} klucz proxy Vite kieruje te sciezke na serwer */
function kluczPokrywa(klucz, sciezka) {
  if (klucz.startsWith('^')) {
    try {
      return new RegExp(klucz).test(sciezka)
    } catch (e) {
      // Klucz, ktorego nie da sie skompilowac, Vite tez odrzuci — nie pokrywa sciezki (uwaga zostaje).
      if (e instanceof SyntaxError) return false
      throw e
    }
  }
  const prefiks = klucz.replace(/\/$/, '')
  return !!prefiks && (sciezka === prefiks || sciezka.startsWith(`${prefiks}/`))
}

/**
 * Uwaga przy planowaniu (P27 (1), vibersi etap 5): sonda E2E_HEALTH z E2E_HEALTH_TRESC na porcie Vite (serwer E2E_URL), a jej
 * sciezki nie pokrywa zaden klucz proxy w vite.config.* — Vite odpowiada fallbackiem SPA i sonda daje STOP startu. Bez tresci
 * sonda przechodzi na kazdej trasie aplikacji (brak sprawdzenia serwera zglasza uwagaSerweraApi).
 * @param {string} projekt @param {Record<string, string>} env @returns {string | null}
 */
export function uwagaProxyZdrowia(projekt, env) {
  if (!env.E2E_HEALTH_TRESC) return null
  const zdrowie = env.E2E_HEALTH ? adresHttp(env.E2E_HEALTH) : null
  const url = adresHttp(env.E2E_URL || `http://localhost:${DOMYSLNY_PORT}`)
  if (!zdrowie || !url || !tenSamSerwer(zdrowie, url) || zdrowie.pathname === '/') return null
  const plik = PLIKI_VITE.find((p) => existsSync(join(projekt, p)))
  if (!plik) return null
  const sciezka = zdrowie.pathname.replace(/\/$/, '')
  if (kluczeProxy(readFileSync(join(projekt, plik), 'utf8')).some((k) => kluczPokrywa(k, sciezka))) return null
  return `ścieżki ${sciezka} z E2E_HEALTH nie ma w trasach proxy ${plik} — Vite odpowie na nią fallbackiem SPA (index.html), więc sonda z E2E_HEALTH_TRESC da STOP startu; dodaj ${sciezka} do tras proxy Vite obok /api albo ustaw E2E_HEALTH na port serwera (.claude/templates/e2e-env/README.md, sekcja „Aplikacja z osobnym serwerem API”)`
}

/** @param {string} url @returns {URL | null} adres http(s) albo null (zapis bez schematu parsuje sie jako schemat `localhost:`) */
function adresHttp(url) {
  const u = URL.canParse(url) ? new URL(url) : null
  return u && (u.protocol === 'http:' || u.protocol === 'https:') ? u : null
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
  const zdrowie = env.E2E_HEALTH || url
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
  // Probny zrzut about:blank w osobnej sesji agent-browser (sesji testera nie dotyka), z limitem na open + screenshot.
  zrzut: () => {
    const plik = join(tmpdir(), `autopilot-e2e-proba-${process.pid}.png`)
    const termin = Date.now() + LIMIT_ZRZUTU_SEK * 1000
    const krok = (/** @type {string[]} */ a) => spawnSync('agent-browser', [...SESJA_PROBY, ...a], { encoding: 'utf8', timeout: Math.max(termin - Date.now(), 1), killSignal: 'SIGKILL' })
    const otwarcie = krok(['open', 'about:blank'])
    const zrzut = otwarcie.status === 0 && !otwarcie.error ? krok(['screenshot', plik]) : otwarcie
    spawnSync('agent-browser', [...SESJA_PROBY, 'close'], { timeout: LIMIT_ZAMKNIECIA_MS, killSignal: 'SIGKILL' })
    rmSync(plik, { force: true })
    if (zrzut.error) return { ok: false, detal: zrzut.error.message.includes('ETIMEDOUT') ? `nie skonczyl sie w ${LIMIT_ZRZUTU_SEK} s` : zrzut.error.message }
    return zrzut.status === 0 ? { ok: true, detal: '' } : { ok: false, detal: `kod ${zrzut.status}: ${(zrzut.stderr || zrzut.stdout || '').trim().split('\n').pop()}` }
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
  // .env.e2e.local ma w Vite (tryb e2e) najwyzszy priorytet — to jego adres trafia do aplikacji.
  const dev = [wczytajEnv(projekt, '.env'), wczytajEnv(projekt, '.env.local')].flatMap((e) => (e?.VITE_SUPABASE_URL ? [originBazy(e.VITE_SUPABASE_URL)] : []))
  const lokalny = wczytajEnv(projekt, '.env.e2e.local')?.VITE_SUPABASE_URL
  const adresE2e = lokalny || env.VITE_SUPABASE_URL
  const zrodlo = lokalny ? '.env.e2e.local' : PLIK_ENV
  if (dev.length && !adresE2e) {
    bledy.push(`brak VITE_SUPABASE_URL w ${PLIK_ENV}, a .env / .env.local go ma — Vite w trybie e2e doczyta baze dev; ustaw adres dedykowanego projektu Supabase e2e`)
  } else if (adresE2e && dev.includes(originBazy(adresE2e))) {
    bledy.push(`VITE_SUPABASE_URL w ${zrodlo} jest taki sam jak w .env / .env.local — E2E potrzebuje dedykowanego projektu Supabase e2e (ochrona bazy dev/prod)`)
  }
  if (konf.bazaE2e) {
    const braki = KLUCZE_BAZY.filter((grupa) => !grupa.some((k) => env[k])).map(([k, ...legacy]) => (legacy.length ? `${k} (albo legacy ${legacy.join(', ')})` : k))
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

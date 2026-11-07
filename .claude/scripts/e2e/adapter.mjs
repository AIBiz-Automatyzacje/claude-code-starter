// Adapter E2E stacku web (Vite + agent-browser) — slot plikowy (rejestr: stacks/sloty.json). Nakladka stacku podmienia ten
// plik w calosci; rdzen (srodowisko.mjs, start.mjs, plan/gotowosc.mjs, doctor) wola tylko eksporty kontraktu ponizej,
// ktory pilnuje __tests__/adapter.test.mjs.
//
// Kontrakt:
//   DOMYSLNY_PORT               port serwera E2E, gdy .env.e2e nie podaje E2E_URL
//   SCIEZKA_ZDROWIA             sciezka doklejana do E2E_URL, gdy .env.e2e nie podaje E2E_HEALTH ('' = sam E2E_URL)
//   PORT_DEV, OPIS_PORTU_DEV    port zwyklego serwera deweloperskiego stacku (null = brak); E2E na nim = UWAGA w doctorze
//   komendaStartu(pm, port)     domyslny E2E_START
//   NARZEDZIE_JAZDY             { nazwa, instalacja, diagnoza } — narzedzie, ktorym tester prowadzi aplikacje
//   sprawdzNarzedzie()          WynikNarzedzia: narzedzie dziala (bez sieci)
//   probnyZrzut()               WynikNarzedzia: narzedzie robi zrzut przed startem serwera
//   LIMIT_ZRZUTU_SEK, opisProbyZrzutu, naprawaZrzutu — limit i teksty STOP-u probnego zrzutu
//   uwagiPlanowania(projekt, env) string[] — uwagi stacku do bramki gotowosci /dev-plan
//   SZKIELET_WERYFIKACJI        teksty sekcji Doctor, Drive, Evidence i Cleanup w szkielecie skilla weryfikacji (szkielet.mjs)
//   POLITYKA_OBCEGO             'stop' | 'zastap' — obcy proces na porcie E2E: STOP startu z PID-em albo zatrzymanie go i start
//                               serwera pipeline'u (D11; zastap dla stacku, w ktorym serwer czyta env przy starcie)
//   SYGNATURY_BLOKERA           SygnaturaBlokera[] — awarie srodowiska stacku w trakcie runu (dowod SKIP-u testera) z polityka
//                               'manual-restart' ([Manual] + restart w nastepnej fazie) albo 'stop-rebuild' (STOP z naprawa,
//                               D12); rdzen ma wlasne sygnatury dev servera i DNS, stack doklada swoje. Dane JSON (restart).
//   przedStartem(projekt, env)  WynikKroku: krok stacku przed startem i restartem serwera (Expo: urzadzenie, pliki env)
//   poStarcie(projekt, env, konf) Promise<WynikKroku>: dowod stacku, gdy serwer juz odpowiada; porazka = STOP startu (Expo: canary)
//   poZatrzymaniu(projekt)      { detal }: sprzatanie stacku po `e2e.mjs stop` (Expo: plik env)
//   uwagaDoctora(projekt)       wiersz doctora [element, stan, szczegol, naprawa] albo null

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { adresHttp, tenSamSerwer } from './adres.mjs'

/** @typedef {{ ok: boolean, detal: string }} WynikNarzedzia */
/** @typedef {{ ok: boolean, detal: string, naprawa: string, przebudowa?: boolean }} WynikKroku przebudowa: restart serwera tego nie usunie, autopilot robi STOP */
/**
 * @typedef {{ wzorzec: string, flagi: string, klasa: string, polityka: 'manual-restart' | 'stop-rebuild', naprawa: string }} SygnaturaBlokera
 */

// Web nie ma kroku stacku wokol serwera: Vite laduje .env.e2e flaga --mode e2e, a dowodem startu jest sonda zdrowia.
/** @type {(projekt: string, env: Record<string, string>) => WynikKroku} */
export const przedStartem = () => ({ ok: true, detal: '', naprawa: '' })
/** @type {(projekt: string, env: Record<string, string>, konf: { port: number }) => Promise<WynikKroku>} */
export const poStarcie = async () => ({ ok: true, detal: '', naprawa: '' })
/** @type {(projekt: string) => { detal: string }} */
export const poZatrzymaniu = () => ({ detal: '' })
/** @type {(projekt: string) => [string, string, string, string] | null} */
export const uwagaDoctora = () => null

// Obcy serwer na porcie E2E to w webie STOP z PID-em (P19): zwykly dev server celuje w baze dev, a restart go nie zmieni.
/** @type {'stop' | 'zastap'} */
export const POLITYKA_OBCEGO = 'stop'
// Web nie ma awarii srodowiska poza sygnaturami rdzenia (dev server, DNS): kazda idzie na [Manual] z restartem serwera.
/** @type {SygnaturaBlokera[]} */
export const SYGNATURY_BLOKERA = []

// 5174, nie 5173: zwykly `pnpm dev` zajmuje 5173 i start E2E zastawal go jako serwer aplikacji (vibersi etap 2, P19).
export const DOMYSLNY_PORT = 5174
export const SCIEZKA_ZDROWIA = ''
export const PORT_DEV = 5173
export const OPIS_PORTU_DEV = 'port zwyklego dev servera Vite'

/** @param {string} pm menedzer pakietow @param {number | string} port @returns {string} */
export const komendaStartu = (pm, port) => `${pm} run dev -- --mode e2e --port ${port} --strictPort`

export const NARZEDZIE_JAZDY = { nazwa: 'agent-browser', instalacja: 'npm install -g agent-browser && agent-browser install', diagnoza: 'agent-browser doctor' }

/** @returns {WynikNarzedzia} */
export function sprawdzNarzedzie() {
  const w = spawnSync('agent-browser', ['doctor', '--offline', '--quick'], { encoding: 'utf8' })
  if (w.error) return { ok: false, detal: `brak agent-browser (${w.error.message})` }
  return { ok: w.status === 0, detal: (w.stdout || '').split('\n').filter((l) => /\bfail\b/.test(l)).join('; ') || `kod ${w.status}` }
}

// Probny zrzut na starcie (P19): vibersi etap 2, faza 6 — `agent-browser screenshot` wisial nawet na about:blank, tester obszedl
// go Playwrightem (971 s). Limit jak w regule testera: zrzut dluzszy niz 30 s = harness niesprawny.
export const LIMIT_ZRZUTU_SEK = 30
const LIMIT_ZAMKNIECIA_MS = 10_000
const SESJA_PROBY = ['--session', 'e2e-proba']
export const opisProbyZrzutu = `probny zrzut agent-browser (about:blank, limit ${LIMIT_ZRZUTU_SEK} s)`
export const naprawaZrzutu = 'Zamknij sesje przegladarki (`agent-browser close --all`), sprawdz `agent-browser doctor` i zrzut recznie: `agent-browser open about:blank && agent-browser screenshot /tmp/proba.png`.'

/**
 * Probny zrzut about:blank w osobnej sesji agent-browser (sesji testera nie dotyka), z limitem na open + screenshot.
 * @returns {WynikNarzedzia}
 */
export function probnyZrzut() {
  const plik = join(tmpdir(), `autopilot-e2e-proba-${process.pid}.png`)
  const termin = Date.now() + LIMIT_ZRZUTU_SEK * 1000
  const krok = (/** @type {string[]} */ a) => spawnSync('agent-browser', [...SESJA_PROBY, ...a], { encoding: 'utf8', timeout: Math.max(termin - Date.now(), 1), killSignal: 'SIGKILL' })
  const otwarcie = krok(['open', 'about:blank'])
  const zrzut = otwarcie.status === 0 && !otwarcie.error ? krok(['screenshot', plik]) : otwarcie
  spawnSync('agent-browser', [...SESJA_PROBY, 'close'], { timeout: LIMIT_ZAMKNIECIA_MS, killSignal: 'SIGKILL' })
  rmSync(plik, { force: true })
  if (zrzut.error) return { ok: false, detal: zrzut.error.message.includes('ETIMEDOUT') ? `nie skonczyl sie w ${LIMIT_ZRZUTU_SEK} s` : zrzut.error.message }
  return zrzut.status === 0 ? { ok: true, detal: '' } : { ok: false, detal: `kod ${zrzut.status}: ${(zrzut.stderr || zrzut.stdout || '').trim().split('\n').pop()}` }
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

/** @param {string} projekt @param {Record<string, string>} env @returns {string[]} */
export function uwagiPlanowania(projekt, env) {
  return [uwagaSerweraApi(projekt, env), uwagaProxyZdrowia(projekt, env)].filter((u) => u !== null)
}

// Szkielet skilla weryfikacji projektu (szkielet.mjs, /weryfikacja-setup): komendy narzedzia jazdy w sekcjach skilla.
export const SZKIELET_WERYFIKACJI = {
  domyslneParametry: 'domyślne (Vite)',
  obcySerwer: 'Port zajęty przez serwer spoza pipeline’u\n(np. zwykły dev server) zatrzymuje Launch z PID-em i komendą procesu w polu `naprawa` — dev server zostaje na swoim porcie, E2E na osobnym.',
  doctor: '`agent-browser doctor`',
  gdzieJazda: 'w przeglądarce',
  atrybutSelektora: 'data-testid',
  /** @type {(pliki: string[], projekt: string) => string[]} trasy z samej struktury plików; web bierze je z konfiguracji routera */
  trasyZPlikow: () => [],
  drive: 'Przeglądarka: skill `agent-browser` — `open <url>` → `snapshot -i` → akcja na refie → `snapshot -i` po każdej zmianie strony.',
  /** @param {number} testId liczba atrybutow data-testid w kodzie @returns {string} */
  selektory: (testId) => (testId
    ? `Selektory: kod ma ${testId} atrybutów \`data-testid\` — przy niejednoznacznym snapshotcie szukaj po nich (\`agent-browser find testid <id> click\`).`
    : 'Selektory: kod nie ma atrybutów `data-testid` — elementy wskazuj rolą i etykietą ze snapshotu.'),
  evidence: [
    'Dowód scenariusza = akcja + stan po akcji + skutek uboczny. Stan: asercja w snapshotcie albo `agent-browser get text` i zrzut',
    '`agent-browser screenshot "$(git rev-parse --show-toplevel)/<folder zadania>/<flow>.png"` (ścieżka bezwzględna: demon agent-browser',
    'rozwiązuje względną od swojego katalogu startowego). Skutek uboczny (zapis, wysyłka): odpowiedź HTTP (`curl -sS`) albo wiersz bazy e2e.',
  ].join('\n'),
  cleanup: '`agent-browser close` zamyka przeglądarkę.',
}

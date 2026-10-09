// Proces serwera aplikacji dla E2E (P14): start w tle z plikiem PID, sonda zdrowia, stan i zatrzymanie.
//
// Plik PID niesie { pid, start, odcisk, uruchomiony }. Tozsamosc procesu = PID + czas startu procesu z `ps -o lstart=`
// (PID ponownie uzyty przez system ma inny czas startu — stop nie zabije obcego procesu). Czas startu czytamy w locale C:
// `lstart` formatuje date wg locale, a start i stop biegna w roznych sesjach (smoke P16: LANG=pl_PL przy starcie, C przy stopie). Konfiguracja (komenda startu,
// odcisk .env.e2e) decyduje tylko, czy nasz serwer jest aktualny: nasz serwer ze stara konfiguracja albo zawieszony
// zatrzymujemy i uruchamiamy od nowa (poprawka operatora w .env.e2e musi zadzialac w swiezym runie).

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { setTimeout as czekaj } from 'node:timers/promises'

const LIMIT_SONDY_MS = 3000
const ODSTEP_SONDY_MS = 500
const LINIE_OGONA_LOGU = 20
const LIMIT_ZATRZYMANIA_MS = 5000

/**
 * @typedef {import('./srodowisko.mjs').Konfiguracja} Konfiguracja
 * @typedef {{ pid: number, start: string, odcisk: string, uruchomiony: string }} ZapisPid
 */

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

/**
 * @param {number} pid
 * @param {NodeJS.ProcessEnv} [env] srodowisko `ps`; domyslnie locale C (format niezalezny od sesji)
 * @returns {string | null} czas startu procesu albo null, gdy procesu nie ma
 */
function czasStartu(pid, env = { ...process.env, LC_ALL: 'C' }) {
  const w = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', env })
  return w.status === 0 && w.stdout.trim() ? w.stdout.trim() : null
}

/** @param {Konfiguracja} konf @returns {ZapisPid | null} zapis pliku PID w formacie pipeline'u albo null */
function zapisPid(konf) {
  if (!existsSync(konf.pid)) return null
  try {
    const z = JSON.parse(readFileSync(konf.pid, 'utf8'))
    return z && Number.isInteger(z.pid) && z.pid > 1 && typeof z.uruchomiony === 'string' ? z : null
  } catch {
    // Inny format pliku (reczny zapis) = nie nasz serwer: null zamiast wyjatku, plik nadpisze start.
    return null
  }
}

/**
 * Proces z pliku zyje i to ten sam proces (czas startu). Plik zapisany przed odczytem w locale C ma date w locale sesji
 * startu — porownanie takze z odczytem w biezacym locale.
 * @param {ZapisPid | null} z
 * @returns {boolean}
 */
const zyjeNasz = (z) => z !== null && (czasStartu(z.pid) === z.uruchomiony || czasStartu(z.pid, process.env) === z.uruchomiony)

/** @param {number} pid @param {NodeJS.Signals} sygnal */
function sygnalGrupie(pid, sygnal) {
  for (const cel of [-pid, pid]) {
    try {
      process.kill(cel, sygnal)
      return
    } catch (blad) {
      if (!(blad instanceof Error && 'code' in blad && blad.code === 'ESRCH')) throw blad
    }
  }
}

/** @param {ZapisPid} z — SIGTERM (z SIGCONT dla zawieszonego), po limicie SIGKILL; czeka na koniec procesu */
async function zatrzymajProces(z) {
  sygnalGrupie(z.pid, 'SIGCONT')
  sygnalGrupie(z.pid, 'SIGTERM')
  const termin = Date.now() + LIMIT_ZATRZYMANIA_MS
  while (Date.now() < termin && zyjeNasz(z)) await czekaj(ODSTEP_SONDY_MS / 5)
  if (zyjeNasz(z)) sygnalGrupie(z.pid, 'SIGKILL')
}

/**
 * Stan serwera pipeline'u — dla testera, gdy aplikacja milczy: nasz serwer martwy (albo watcher zywy) z bledem kodu na koncu
 * logu = kod fazy go polozyl; serwer nie nasz albo bez bledu w logu = awaria srodowiska.
 * @param {Konfiguracja} konf
 * @returns {{ nasz: boolean, pid: number | null, zyje: boolean, uruchomiony: string | null, log: string, ogonLogu: string }}
 */
export function stanSerwera(konf) {
  const z = zapisPid(konf)
  return {
    nasz: z !== null, pid: z?.pid ?? null, zyje: zyjeNasz(z), uruchomiony: z?.uruchomiony ?? null, log: konf.log,
    ogonLogu: z !== null ? ogonLogu(konf.log) : '(serwer nie jest uruchomiony przez pipeline)',
  }
}

/**
 * Start serwera aplikacji. Nasz zywy serwer z aktualna konfiguracja i odpowiedzia = `uruchomione`; nasz ze stara konfiguracja
 * albo zawieszony — zatrzymany i uruchomiony od nowa; obcy odpowiadajacy serwer = `zastane` (ostrzezenie o bazie dev).
 * @param {string} projekt
 * @param {Konfiguracja} konf
 * @param {Record<string, string>} env doklejane do srodowiska komendy startu
 * @returns {Promise<{ serwer: 'uruchomione' | 'zastane' | 'brak', blad?: string }>}
 */
export async function uruchomSerwer(projekt, konf, env) {
  const z = zapisPid(konf)
  if (zyjeNasz(z) && z) {
    const aktualny = z.start === konf.start && z.odcisk === konf.odcisk
    if (aktualny && await odpowiada(konf.zdrowie)) return { serwer: 'uruchomione' }
    await zatrzymajProces(z)
  }
  rmSync(konf.pid, { force: true })
  if (await odpowiada(konf.zdrowie)) return { serwer: 'zastane' }
  const log = openSync(konf.log, 'w')
  const dziecko = spawn(konf.start, { cwd: projekt, shell: true, detached: true, stdio: ['ignore', log, log], env: { ...process.env, ...env } })
  closeSync(log)
  /** @type {number | string | null} */
  let wyjscie = null
  dziecko.on('exit', (kod, sygnal) => { wyjscie = kod ?? sygnal ?? 'nieznany' })
  dziecko.unref()
  const uruchomiony = dziecko.pid === undefined ? null : czasStartu(dziecko.pid)
  if (dziecko.pid === undefined || uruchomiony === null) return { serwer: 'brak', blad: `komenda startu nie wystartowala: ${konf.start}. Log ${konf.log}:\n${ogonLogu(konf.log)}` }
  /** @type {ZapisPid} */
  const zapis = { pid: dziecko.pid, start: konf.start, odcisk: konf.odcisk, uruchomiony }
  writeFileSync(konf.pid, JSON.stringify(zapis))
  const termin = Date.now() + konf.limitSek * 1000
  while (Date.now() < termin) {
    if (await odpowiada(konf.zdrowie)) return { serwer: 'uruchomione' }
    if (wyjscie !== null) {
      rmSync(konf.pid, { force: true })
      return { serwer: 'brak', blad: `komenda startu „${konf.start}” zakonczyla sie (${wyjscie}) przed odpowiedzia ${konf.zdrowie}. Log ${konf.log}:\n${ogonLogu(konf.log)}` }
    }
    await czekaj(ODSTEP_SONDY_MS)
  }
  await zatrzymajProces(zapis)
  rmSync(konf.pid, { force: true })
  return { serwer: 'brak', blad: `${konf.zdrowie} nie odpowiada po ${konf.limitSek} s od „${konf.start}” (zajety port, zla komenda albo E2E_START_TIMEOUT za krotki). Log ${konf.log}:\n${ogonLogu(konf.log)}` }
}

/**
 * Zatrzymuje wylacznie serwer pipeline'u (ten sam proces co w pliku PID); zastany i obcy proces zostaja.
 * @param {Konfiguracja} konf
 * @returns {Promise<{ posprzatano: boolean, detal: string }>}
 */
export async function zatrzymajSerwer(konf) {
  if (!existsSync(konf.pid)) return { posprzatano: true, detal: 'brak pliku PID — serwer zastany albo nieuruchomiony, nic do zatrzymania' }
  const z = zapisPid(konf)
  const dzialal = zyjeNasz(z)
  if (z && dzialal) await zatrzymajProces(z)
  rmSync(konf.pid, { force: true })
  rmSync(konf.log, { force: true })
  if (!z) return { posprzatano: true, detal: 'plik PID w innym formacie — usuniety, zaden proces nie zatrzymany' }
  return { posprzatano: true, detal: dzialal ? `zatrzymany serwer PID ${z.pid}` : `serwer PID ${z.pid} juz nie dzialal (albo PID nalezy do innego procesu) — nic nie zatrzymano` }
}

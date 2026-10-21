// Proces serwera aplikacji dla E2E (P14): start w tle z plikiem PID, sonda zdrowia, stan i zatrzymanie.
//
// Plik PID niesie { pid, start, odcisk, uruchomiony }. Tozsamosc procesu = PID + czas startu procesu z `ps -o lstart=`
// (PID ponownie uzyty przez system ma inny czas startu — stop nie zabije obcego procesu). Czas startu czytamy w locale C:
// `lstart` formatuje date wg locale, a start i stop biegna w roznych sesjach (smoke P16: LANG=pl_PL przy starcie, C przy stopie). Konfiguracja (komenda startu,
// odcisk .env.e2e) decyduje tylko, czy nasz serwer jest aktualny: nasz serwer ze stara konfiguracja albo zawieszony
// zatrzymujemy i uruchamiamy od nowa (poprawka operatora w .env.e2e musi zadzialac w swiezym runie).
// Obcy serwer na porcie E2E (P19, vibersi etap 2: zwykly `vite --port 5173` na bazie dev przyjety jako „zastany”, 9 scenariuszy
// SKIP) to porazka startu z PID-em i komenda procesu: pipeline nie testuje na serwerze, ktorego konfiguracji nie zna.

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { setTimeout as czekaj } from 'node:timers/promises'

const LIMIT_SONDY_MS = 3000
const ODSTEP_SONDY_MS = 500
const LINIE_OGONA_LOGU = 20
const LIMIT_ZATRZYMANIA_MS = 5000
// Token Management API (advisors) — dostep do calego konta Supabase; procesowi aplikacji niepotrzebny, takze z powloki operatora.
const KLUCZE_POZA_SERWEREM = ['SUPABASE_ACCESS_TOKEN']

/**
 * @typedef {import('./srodowisko.mjs').Konfiguracja} Konfiguracja
 * @typedef {{ pid: number, start: string, odcisk: string, uruchomiony: string }} ZapisPid
 * @typedef {{ pid: number | null, komenda: string | null }} ObcySerwer
 */

/**
 * Czy adres odpowiada statusem < 500 (odmowa polaczenia i timeout = nie). Z `tresc` (E2E_HEALTH_TRESC, P25 A2) odpowiedz musi ja
 * zawierac: fallback SPA (index.html z 200 na kazdej sciezce) nie udaje wtedy dzialajacego serwera API.
 * @param {string} url @param {string | null} [tresc] @returns {Promise<boolean>}
 */
export async function odpowiada(url, tresc = null) {
  try {
    const odpowiedz = await fetch(url, { signal: AbortSignal.timeout(LIMIT_SONDY_MS), redirect: 'manual' })
    if (odpowiedz.status >= 500) return false
    return !tresc || (await odpowiedz.text()).includes(tresc)
  } catch {
    // Wynik sondy, nie awaria skryptu: odmowa polaczenia, DNS albo timeout znacza „serwer nie dziala”.
    return false
  }
}

/**
 * Proces nasluchujacy na porcie TCP (lsof): proces, null (brak nasluchu) albo undefined (lsof niedostepny — wtedy decyduje sonda).
 * @param {number} port
 * @returns {{ pid: number, komenda: string } | null | undefined}
 */
export function procesNaPorcie(port) {
  const w = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' })
  if (w.error) return undefined
  const pid = Number((w.stdout ?? '').trim().split('\n')[0])
  if (!Number.isInteger(pid) || pid <= 1) return null
  const ps = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' })
  return { pid, komenda: (ps.stdout ?? '').trim() || '(komenda nieznana)' }
}

/**
 * Serwer spoza pipeline'u na porcie E2E. Wolane, gdy naszego zywego serwera nie ma — kazdy nasluch jest wtedy obcy. Adres
 * lokalny z dzialajacym lsof: tylko nasluch na porcie; bez lsof albo dla hosta nielokalnego: odpowiedz E2E_URL (nie
 * E2E_HEALTH — sonda moze wskazywac inna, stale dzialajaca usluge).
 * @param {Konfiguracja} konf
 * @returns {Promise<ObcySerwer | null>}
 */
async function obcySerwer(konf) {
  const proces = konf.lokalny ? procesNaPorcie(konf.port) : undefined
  if (proces !== undefined) return proces
  return await odpowiada(konf.url) ? { pid: null, komenda: null } : null
}

/** @param {Konfiguracja} konf @param {ObcySerwer} obcy @returns {string} */
export function opisObcego(konf, obcy) {
  const kto = obcy.pid ? ` — PID ${obcy.pid}: ${obcy.komenda}` : ` — ${konf.url} odpowiada`
  return `na porcie ${konf.port} dziala serwer spoza pipeline'u${kto}. Pipeline nie testuje na nim: nie zna jego konfiguracji (zwykly dev server celuje w baze dev)`
}

/** @param {Konfiguracja} konf @param {ObcySerwer} obcy @returns {string} */
export function naprawaObcego(konf, obcy) {
  const stop = obcy.pid ? `Zatrzymaj go: \`kill ${obcy.pid}\` (sprawdz wczesniej, czy to nie Twoj dev server w uzyciu)` : `Zatrzymaj serwer odpowiadajacy na ${konf.url}`
  return `${stop} albo ustaw w .env.e2e wolny port: E2E_URL=http://localhost:<port>. Kto trzyma port: \`lsof -nP -iTCP:${konf.port} -sTCP:LISTEN\`.`
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
  // Potomek, ktory przezyl SIGTERM po smierci rodzica, zostaje w grupie procesu i trzyma port — bez tego restart widzialby go
  // jako obcy serwer. Tylko grupa (-pid): sam PID mogl juz trafic do innego procesu.
  try {
    process.kill(-z.pid, 'SIGKILL')
  } catch (blad) {
    if (!(blad instanceof Error && 'code' in blad && blad.code === 'ESRCH')) throw blad
  }
}

/** @param {string} url @returns {Promise<void>} czeka, az zatrzymany serwer przestanie odpowiadac (dzieci procesu zwalniaja port pozniej) */
async function czekajNaZwolnienie(url) {
  const termin = Date.now() + LIMIT_ZATRZYMANIA_MS
  while (Date.now() < termin && await odpowiada(url)) await czekaj(ODSTEP_SONDY_MS / 5)
}

/**
 * Stan serwera pipeline'u — dla testera, gdy aplikacja milczy: nasz serwer martwy (albo watcher zywy) z bledem kodu na koncu
 * logu = kod fazy go polozyl; serwer nie nasz albo bez bledu w logu = awaria srodowiska. Start, ktory padl przed odpowiedzia,
 * zostawia plik PID martwego procesu (P17) — `stan` pokazuje wtedy nasz martwy serwer z ogonem logu, nie „nie nasz”.
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
 * albo zawieszony — zatrzymany i uruchomiony od nowa; obcy serwer na porcie = `obcy` z bledem, PID-em i komenda (P19).
 * `odNowa` (restart przed testerem fazy, P17): nasz serwer zatrzymany i uruchomiony od nowa zawsze — serwer sprzed zmian fazy
 * nie wczytuje pliku konfiguracji, ktorego nie bylo przy jego starcie (vibersi: vite.config.ts z IU-1, 500 w fazie 4).
 * Porazka niesie kod wyjscia komendy i ogon logu: start przed faza 1 rozpoznaje po nich projekt bez aplikacji.
 * @param {string} projekt
 * @param {Konfiguracja} konf
 * @param {Record<string, string>} env doklejane do srodowiska komendy startu
 * @param {{ odNowa?: boolean }} [opcje]
 * @returns {Promise<{ serwer: 'uruchomione' | 'obcy' | 'brak', blad?: string, obcy?: ObcySerwer, wyjscie?: number | string, ogon?: string }>}
 */
export async function uruchomSerwer(projekt, konf, env, { odNowa = false } = {}) {
  const z = zapisPid(konf)
  if (zyjeNasz(z) && z) {
    const aktualny = !odNowa && z.start === konf.start && z.odcisk === konf.odcisk
    if (aktualny && await odpowiada(konf.zdrowie, konf.zdrowieTresc)) return { serwer: 'uruchomione' }
    await zatrzymajProces(z)
    // Bez tego sonda nizej trafia na port, ktory dziecko starego serwera jeszcze trzyma — nasz stary serwer jako obcy.
    await czekajNaZwolnienie(konf.zdrowie)
  }
  rmSync(konf.pid, { force: true })
  const obcy = await obcySerwer(konf)
  if (obcy) return { serwer: 'obcy', blad: opisObcego(konf, obcy), obcy }
  const log = openSync(konf.log, 'w')
  const srodowisko = { ...process.env, ...env }
  for (const k of KLUCZE_POZA_SERWEREM) delete srodowisko[k]
  const dziecko = spawn(konf.start, { cwd: projekt, shell: true, detached: true, stdio: ['ignore', log, log], env: srodowisko })
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
    if (await odpowiada(konf.zdrowie, konf.zdrowieTresc)) return { serwer: 'uruchomione' }
    if (wyjscie !== null) {
      // Plik PID martwego procesu zostaje: `stan` pokaze nasz serwer z ogonem logu (kod fazy go polozyl), nastepny start go nadpisze.
      const ogon = ogonLogu(konf.log)
      return { serwer: 'brak', blad: `komenda startu „${konf.start}” zakonczyla sie (${wyjscie}) przed odpowiedzia ${konf.zdrowie}. Log ${konf.log}:\n${ogon}`, wyjscie, ogon }
    }
    await czekaj(ODSTEP_SONDY_MS)
  }
  await zatrzymajProces(zapis)
  rmSync(konf.pid, { force: true })
  const oczekiwana = konf.zdrowieTresc ? ` (oczekiwana treść „${konf.zdrowieTresc}” — E2E_HEALTH_TRESC)` : ''
  return { serwer: 'brak', blad: `${konf.zdrowie}${oczekiwana} nie odpowiada po ${konf.limitSek} s od „${konf.start}” (zajety port, zla komenda albo E2E_START_TIMEOUT za krotki). Log ${konf.log}:\n${ogonLogu(konf.log)}` }
}

/**
 * Stan portu dla sprawdzenia bez startu (sekcja Doctor): nasz zywy serwer, obcy serwer albo wolny port.
 * @param {Konfiguracja} konf
 * @returns {Promise<{ serwer: 'uruchomione' | 'obcy' | 'brak', obcy?: ObcySerwer }>}
 */
export async function stanPortu(konf) {
  if (zyjeNasz(zapisPid(konf))) return { serwer: 'uruchomione' }
  const obcy = await obcySerwer(konf)
  return obcy ? { serwer: 'obcy', obcy } : { serwer: 'brak' }
}

/**
 * Zatrzymuje wylacznie serwer pipeline'u (ten sam proces co w pliku PID); obcy proces zostaje.
 * @param {Konfiguracja} konf
 * @returns {Promise<{ posprzatano: boolean, detal: string }>}
 */
export async function zatrzymajSerwer(konf) {
  if (!existsSync(konf.pid)) return { posprzatano: true, detal: 'brak pliku PID — serwer nieuruchomiony przez pipeline, nic do zatrzymania' }
  const z = zapisPid(konf)
  const dzialal = zyjeNasz(z)
  if (z && dzialal) await zatrzymajProces(z)
  rmSync(konf.pid, { force: true })
  rmSync(konf.log, { force: true })
  if (!z) return { posprzatano: true, detal: 'plik PID w innym formacie — usuniety, zaden proces nie zatrzymany' }
  return { posprzatano: true, detal: dzialal ? `zatrzymany serwer PID ${z.pid}` : `serwer PID ${z.pid} juz nie dzialal (albo PID nalezy do innego procesu) — nic nie zatrzymano` }
}

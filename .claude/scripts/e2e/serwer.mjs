// Proces serwera aplikacji dla E2E (P14): start w tle z plikiem PID, sonda zdrowia, stan i zatrzymanie.
//
// Plik PID niesie { pid, start, odcisk } — serwer jest „nasz” tylko przy tej samej komendzie startu i tym samym .env.e2e
// (odcisk z konfiguracji). Proces bez uprawnien (EPERM), PID <= 1 albo inny zapis pliku = nie nasz: nie zabijamy go i nie
// uznajemy za serwer pipeline'u (inaczej stary plik z PID-em ponownie uzytym przez system zabilby obcy proces).

import { spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { setTimeout as czekaj } from 'node:timers/promises'

const LIMIT_SONDY_MS = 3000
const ODSTEP_SONDY_MS = 500
const LINIE_OGONA_LOGU = 20

/** @typedef {import('./srodowisko.mjs').Konfiguracja} Konfiguracja */

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

/** @param {number} pid @returns {boolean} proces istnieje i nalezy do nas (EPERM = cudzy) */
function zyje(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (blad) {
    if (blad instanceof Error && 'code' in blad && (blad.code === 'ESRCH' || blad.code === 'EPERM')) return false
    throw blad
  }
}

/** @param {Konfiguracja} konf @returns {number | null} PID serwera pipeline'u z pliku (bez sprawdzania, czy zyje) */
function naszPid(konf) {
  if (!existsSync(konf.pid)) return null
  let zapis
  try {
    zapis = JSON.parse(readFileSync(konf.pid, 'utf8'))
  } catch {
    // Plik w innym formacie (reczny zapis, stary run) = nie nasz serwer; sprawdzenie zwraca null zamiast wyjatku.
    return null
  }
  const ok = zapis && Number.isInteger(zapis.pid) && zapis.pid > 1 && zapis.start === konf.start && zapis.odcisk === konf.odcisk
  return ok ? zapis.pid : null
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
 * Stan serwera pipeline'u — dla testera, gdy aplikacja milczy: nasz serwer martwy z bledem kodu w logu = kod fazy go polozyl;
 * serwer nie nasz (zastany, brak PID) albo zabity bez bledu = awaria srodowiska.
 * @param {Konfiguracja} konf
 * @returns {{ nasz: boolean, pid: number | null, zyje: boolean, log: string, ogonLogu: string }}
 */
export function stanSerwera(konf) {
  const pid = naszPid(konf)
  return { nasz: pid !== null, pid, zyje: pid !== null && zyje(pid), log: konf.log, ogonLogu: pid !== null ? ogonLogu(konf.log) : '(serwer nie jest uruchomiony przez pipeline)' }
}

/**
 * Start serwera aplikacji: zastany (odpowiada przed startem, nie nasz) albo uruchomiony w tle; czeka na sonde zdrowia.
 * Zywy serwer pipeline'u z poprzedniego runu (STOP zostawia srodowisko) = `uruchomione`, sprzata go env-down.
 * @param {string} projekt
 * @param {Konfiguracja} konf
 * @param {Record<string, string>} env doklejane do srodowiska komendy startu
 * @returns {Promise<{ serwer: 'uruchomione' | 'zastane' | 'brak', blad?: string }>}
 */
export async function uruchomSerwer(projekt, konf, env) {
  if (await odpowiada(konf.zdrowie)) {
    const pid = naszPid(konf)
    return { serwer: pid !== null && zyje(pid) ? 'uruchomione' : 'zastane' }
  }
  const log = openSync(konf.log, 'w')
  const dziecko = spawn(konf.start, { cwd: projekt, shell: true, detached: true, stdio: ['ignore', log, log], env: { ...process.env, ...env } })
  closeSync(log)
  /** @type {number | string | null} */
  let wyjscie = null
  dziecko.on('exit', (kod, sygnal) => { wyjscie = kod ?? sygnal ?? 'nieznany' })
  dziecko.unref()
  if (dziecko.pid === undefined) return { serwer: 'brak', blad: `komenda startu nie wystartowala: ${konf.start}` }
  writeFileSync(konf.pid, JSON.stringify({ pid: dziecko.pid, start: konf.start, odcisk: konf.odcisk }))
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
 * Zatrzymuje wylacznie serwer pipeline'u (plik PID z ta sama komenda i odciskiem); zastany i obcy proces zostaja.
 * @param {Konfiguracja} konf
 * @returns {{ posprzatano: boolean, detal: string }}
 */
export function zatrzymajSerwer(konf) {
  if (!existsSync(konf.pid)) return { posprzatano: true, detal: 'brak pliku PID — serwer zastany albo nieuruchomiony, nic do zatrzymania' }
  const pid = naszPid(konf)
  rmSync(konf.pid, { force: true })
  if (pid === null) return { posprzatano: true, detal: 'plik PID nie pasuje do konfiguracji (inna komenda albo .env.e2e) — usuniety, zaden proces nie zatrzymany' }
  const dzialal = zyje(pid)
  if (dzialal) zabijGrupe(pid)
  rmSync(konf.log, { force: true })
  return { posprzatano: true, detal: dzialal ? `zatrzymany serwer PID ${pid}` : `serwer PID ${pid} juz nie dzialal` }
}

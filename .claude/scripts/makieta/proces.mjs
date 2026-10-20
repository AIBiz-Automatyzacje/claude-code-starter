// Proces serwera narzedzia makiet w tle (P24 IU-6): katalog stanu poza repo, plik `serwer.json`, tozsamosc procesu, start,
// zatrzymanie i przejecie poprzedniej instancji. Wzor: e2e/serwer.mjs (P14/P16/P19) — tozsamosc = PID + czas startu z
// `ps -o lstart=` w locale C (PID ponownie uzyty przez system ma inny czas startu), zatrzymanie grupy procesow z limitem,
// nigdy PID <= 1. Stan poza drzewem projektu (HANDOFF A2: plik w drzewie blokuje autopilota i `gotowosc`): jedynym stanem
// w repo zostaje linia checklisty. Jedna instancja na projekt.
//
// Port i adres stale (`http://127.0.0.1:5180`): PKCE i sesja zaleza od originu, a OAuth wymaga wpisu w Redirect URLs Supabase
// dev. Port zajety przez obcy proces = blad z PID-em i komenda (bez szukania wolnego).

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { setTimeout as czekaj } from 'node:timers/promises'

export { odpowiada, procesNaPorcie } from '../e2e/serwer.mjs'

export const DOMYSLNY_PORT = 5180
export const DOMYSLNA_APLIKACJA = 'http://localhost:5173'
const LIMIT_ZATRZYMANIA_MS = 5000
const ODSTEP_MS = 100
const PLIK_SERWERA = 'serwer.json'

/** @typedef {{ pid: number, uruchomiony: string, port: number, token: string, smoke: string, aplikacja: string, start: string }} ZapisSerwera */

/**
 * Katalog stanu instancji projektu. Istniejacy katalog musi nalezec do biezacego uzytkownika i nie byc dowiazaniem — na Linuksie
 * bez TMPDIR `/tmp` jest wspolny, a przez `kolejka.jsonl` obcy tekst trafilby do Monitora sesji.
 * @param {string} projekt
 * @returns {string} `$TMPDIR/claude-makieta/<nazwa katalogu projektu>-<skrot sciezki>/`
 */
export function katalogStanu(projekt) {
  const sciezka = realpathSync(projekt)
  const katalog = join(tmpdir(), 'claude-makieta', `${basename(sciezka)}-${createHash('sha1').update(sciezka).digest('hex').slice(0, 8)}`)
  if (existsSync(katalog)) {
    const s = lstatSync(katalog)
    if (s.isSymbolicLink() || !s.isDirectory() || (process.getuid && s.uid !== process.getuid())) throw new Error(`katalog stanu ${katalog} nie jest katalogiem bieżącego użytkownika — usuń go`)
  }
  return katalog
}

/**
 * @param {number} pid
 * @param {NodeJS.ProcessEnv} [env] srodowisko `ps`; domyslnie locale C (format niezalezny od sesji)
 * @returns {string | null} czas startu procesu albo null, gdy procesu nie ma
 */
export function czasStartu(pid, env = { ...process.env, LC_ALL: 'C' }) {
  const w = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', env })
  return w.status === 0 && w.stdout.trim() ? w.stdout.trim() : null
}

/** @param {string} stan @returns {ZapisSerwera | null} zapis instancji albo null (brak, inny format, PID <= 1) */
export function zapisSerwera(stan) {
  const plik = join(stan, PLIK_SERWERA)
  if (!existsSync(plik)) return null
  try {
    const z = JSON.parse(readFileSync(plik, 'utf8'))
    return z && Number.isInteger(z.pid) && z.pid > 1 && typeof z.uruchomiony === 'string' && typeof z.token === 'string' && Number.isInteger(z.port) ? z : null
  } catch {
    // Uszkodzony albo obcy plik = brak naszej instancji; start go nadpisze, stop usunie.
    return null
  }
}

/** @param {string} stan @param {ZapisSerwera} z */
export function zapiszSerwer(stan, z) {
  mkdirSync(stan, { recursive: true, mode: 0o700 })
  writeFileSync(join(stan, PLIK_SERWERA), JSON.stringify(z), { mode: 0o600 })
}

/** @param {ZapisSerwera | null} z @returns {boolean} proces z zapisu zyje i to ten sam proces (czas startu) */
export const zyjeNasz = (z) => z !== null && z.pid > 1 && czasStartu(z.pid) === z.uruchomiony

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

/**
 * Zatrzymanie instancji z `serwer.json`: SIGTERM grupy, po limicie SIGKILL; obcy proces (inny czas startu, PID <= 1) zostaje.
 * @param {string} stan
 * @returns {Promise<{ zatrzymany: boolean, detal: string }>}
 */
export async function zatrzymaj(stan) {
  const z = zapisSerwera(stan)
  const plik = join(stan, PLIK_SERWERA)
  if (!z) {
    const byl = existsSync(plik)
    rmSync(plik, { force: true })
    return { zatrzymany: false, detal: byl ? 'serwer.json w innym formacie — usunięty, żaden proces nie zatrzymany' : 'narzędzie nie działa w tym projekcie' }
  }
  if (!zyjeNasz(z)) {
    rmSync(plik, { force: true })
    return { zatrzymany: false, detal: `serwer PID ${z.pid} już nie działał (albo PID należy do innego procesu) — nic nie zatrzymano` }
  }
  sygnalGrupie(z.pid, 'SIGCONT')
  sygnalGrupie(z.pid, 'SIGTERM')
  const termin = Date.now() + LIMIT_ZATRZYMANIA_MS
  while (Date.now() < termin && zyjeNasz(z)) await czekaj(ODSTEP_MS)
  if (zyjeNasz(z)) {
    sygnalGrupie(z.pid, 'SIGKILL')
    // Port zwalnia sie dopiero po koncu procesu — bez czekania nastepny start widzialby go jako obcy.
    const koniec = Date.now() + LIMIT_ZATRZYMANIA_MS
    while (Date.now() < koniec && zyjeNasz(z)) await czekaj(ODSTEP_MS)
  }
  rmSync(plik, { force: true })
  return { zatrzymany: true, detal: `zatrzymany serwer PID ${z.pid}` }
}

/** @param {string} url @param {number} limitMs @param {(url: string) => Promise<boolean>} sonda @returns {Promise<boolean>} */
export async function czekajNaOdpowiedz(url, limitMs, sonda) {
  const termin = Date.now() + limitMs
  for (;;) {
    if (await sonda(url)) return true
    if (Date.now() >= termin) return false
    await czekaj(Math.min(500, Math.max(0, termin - Date.now())))
  }
}

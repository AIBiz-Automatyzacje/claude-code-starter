// Dowód, że flow ruszy (A0.1 #10): reload Metro i przejście Maestro. Login REST kontem e2e robi już rdzeń (D16). Wersjonowany
// .maestro/_canary.yaml przechodzi przez logowanie; bez niego idzie tymczasowy flow wejścia w dev-client, który dowodzi tylko, że
// aplikacja wstaje, i o tym mówi uwaga w wyniku. Wyjście Maestro idzie na stderr z zamaskowanymi wartościami: stdout e2e.mjs
// to jedna linia JSON, a strumień resetuje watchdog ciszy agenta.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const PLIK_CANARY = '.maestro/_canary.yaml'
const LIMIT_CANARY_MS = 240_000
const LIMIT_RELOADU_MS = 3000
const LINIE_OGONA = 8
// Emulator Androida widzi komputer pod 10.0.2.2, symulator iOS pod adresem pętli zwrotnej.
const HOST_METRO = { ios: '127.0.0.1', android: '10.0.2.2' }

/** @typedef {import('./expo-urzadzenie.mjs').Urzadzenie} Urzadzenie */
/** @typedef {import('./expo-urzadzenie.mjs').Aplikacja} Aplikacja */

/**
 * Pełny reload aplikacji połączonych z Metro (to samo co klawisz r w `expo start`). Bez połączonej aplikacji nie ma skutku.
 * @param {number} port @returns {Promise<{ ok: boolean, detal: string }>}
 */
export function wyslijReload(port) {
  return new Promise((rozwiaz) => {
    const gniazdo = new WebSocket(`ws://localhost:${port}/message`)
    const termin = setTimeout(() => { gniazdo.close(); rozwiaz({ ok: false, detal: `brak połączenia w ${LIMIT_RELOADU_MS} ms` }) }, LIMIT_RELOADU_MS)
    gniazdo.addEventListener('open', () => {
      gniazdo.send(JSON.stringify({ version: 2, method: 'reload' }))
      clearTimeout(termin)
      // Zamknięcie zaraz po send gubi wiadomość: Metro nie zdąży jej rozesłać.
      setTimeout(() => { gniazdo.close(); rozwiaz({ ok: true, detal: '' }) }, 300)
    })
    gniazdo.addEventListener('error', () => {
      clearTimeout(termin)
      rozwiaz({ ok: false, detal: `błąd połączenia ws://localhost:${port}/message` })
    })
  })
}

/** @param {'ios' | 'android'} platforma @param {number} port @returns {string} adres Metro zakodowany do parametru deep linku */
export const adresMetro = (platforma, port) => encodeURIComponent(`http://${HOST_METRO[platforma]}:${port}`)

/**
 * Tymczasowy flow bez logowania, poza repo: osierocony plik w drzewie blokowałby bramkę czystości brancha. `stopApp` + `openLink`,
 * nigdy `launchApp` + `openLink`: deep link do żywego procesu wywraca runtime dev-clienta.
 * @param {string} appId @param {string | null} scheme @param {string} adres @returns {string}
 */
export function flowWejscia(appId, scheme, adres) {
  const kroki = scheme
    ? ['- stopApp', `- openLink: "${scheme}://expo-development-client/?url=${adres}"`, '- tapOn:', '    text: "Otwórz|Open"', '    optional: true', '- extendedWaitUntil:', '    notVisible:', '      text: "DEVELOPMENT SERVERS"', '    timeout: 60000']
    : ['- launchApp']
  return [`appId: ${appId}`, '---', ...kroki, '- assertNotVisible:', '    text: ".*Cannot find native module.*"', '- takeScreenshot: canary', ''].join('\n')
}

/** @param {string} tekst @param {string[]} sekrety @returns {string} */
export const zamaskuj = (tekst, sekrety) => sekrety.filter(Boolean).reduce((t, s) => t.split(s).join('***'), tekst)

/**
 * @param {string[]} argumenty @param {string} cwd @param {{ sekrety: string[], srodowisko?: Record<string, string> }} zmienne @param {number} [limitMs]
 * @returns {Promise<{ kod: number | string | null, ogon: string }>}
 */
export function uruchomMaestro(argumenty, cwd, { sekrety, srodowisko = {} }, limitMs = LIMIT_CANARY_MS) {
  return new Promise((rozwiaz) => {
    const proces = spawn('maestro', argumenty, { cwd, env: { ...process.env, ...srodowisko }, stdio: ['ignore', 'pipe', 'pipe'] })
    let wyjscie = ''
    const zbieraj = (/** @type {Buffer} */ porcja) => {
      const tekst = zamaskuj(porcja.toString(), sekrety)
      wyjscie += tekst
      process.stderr.write(tekst)
    }
    proces.stdout.on('data', zbieraj)
    proces.stderr.on('data', zbieraj)
    const termin = setTimeout(() => proces.kill('SIGKILL'), limitMs)
    proces.on('error', (e) => { clearTimeout(termin); rozwiaz({ kod: e.message, ogon: '' }) })
    proces.on('close', (kod, sygnal) => {
      clearTimeout(termin)
      rozwiaz({ kod: kod ?? sygnal, ogon: wyjscie.trimEnd().split('\n').slice(-LINIE_OGONA).join('\n') })
    })
  })
}

/** @param {string} katalog */
function usunZapisKomend(katalog) {
  for (const w of readdirSync(katalog, { recursive: true, withFileTypes: true })) {
    if (w.isFile() && /^commands-.*\.json$/.test(w.name)) rmSync(join(w.parentPath, w.name))
  }
}

/**
 * Zmienne flow: te same dla canary i scenariuszy, a klucze `MAESTRO_*` z .env.e2e dla skryptów `runScript`. Konto i klucze idą w środowisku
 * procesu, bo argumenty widać w `ps` i `pgrep -fl`; Maestro sam udostępnia flow zmienne z prefiksem `MAESTRO_`. W `-e` zostają wartości jawne.
 * @param {Record<string, string>} env @param {{ port: number, urzadzenie: Urzadzenie, aplikacja: Aplikacja }} cel
 * @returns {{ argumenty: string[], srodowisko: Record<string, string>, sekrety: string[] }}
 */
export function zmienneFlow(env, { port, urzadzenie, aplikacja }) {
  const maestroweKlucze = Object.entries(env).filter(([k]) => k.startsWith('MAESTRO_'))
  const jawne = [['APP_ID', urzadzenie.platforma === 'ios' ? aplikacja.bundleId : aplikacja.appId], ['APP_SCHEME', aplikacja.scheme], ['METRO_URL', adresMetro(urzadzenie.platforma, port)]]
  const tajne = [...maestroweKlucze, ['MAESTRO_E2E_EMAIL', env.E2E_TEST_EMAIL], ['MAESTRO_E2E_PASSWORD', env.E2E_TEST_PASSWORD]]
  return {
    argumenty: jawne.filter(([, v]) => v).flatMap(([k, v]) => ['-e', `${k}=${v}`]),
    srodowisko: Object.fromEntries(tajne.filter(([, v]) => v)),
    sekrety: [env.E2E_TEST_PASSWORD, ...maestroweKlucze.map(([, v]) => v)],
  }
}

/**
 * @param {string} projekt @param {Record<string, string>} env @param {{ port: number, urzadzenie: Urzadzenie, aplikacja: Aplikacja }} cel
 * @param {{ maestro?: typeof uruchomMaestro }} [opcje]
 * @returns {Promise<{ ok: boolean, detal: string, naprawa: string }>}
 */
export async function przejdzCanary(projekt, env, { port, urzadzenie, aplikacja }, { maestro = uruchomMaestro } = {}) {
  const idAplikacji = urzadzenie.platforma === 'ios' ? aplikacja.bundleId : aplikacja.appId
  const adres = adresMetro(urzadzenie.platforma, port)
  const robocze = mkdtempSync(join(tmpdir(), 'expo-canary-'))
  const wlasny = existsSync(join(projekt, PLIK_CANARY))
  const flow = wlasny ? PLIK_CANARY : join(robocze, 'canary.yaml')
  if (!wlasny) writeFileSync(flow, flowWejscia(String(idAplikacji), aplikacja.scheme, adres))
  const { argumenty: argumentyEnv, srodowisko, sekrety } = zmienneFlow(env, { port, urzadzenie, aplikacja })
  const { kod, ogon } = await maestro(['--device', urzadzenie.id, 'test', '--test-output-dir', robocze, '--debug-output', join(robocze, 'debug'), ...argumentyEnv, flow], projekt, { sekrety, srodowisko })
  if (kod === 0) {
    rmSync(robocze, { recursive: true, force: true })
    const typ = wlasny ? `${PLIK_CANARY} przeszedł` : `canary bez logowania przeszedł, to słaby dowód: dodaj ${PLIK_CANARY} (wzór: .claude/templates/e2e-env/_canary.yaml)`
    return { ok: true, detal: `${urzadzenie.platforma} ${urzadzenie.nazwa}: ${typ}`, naprawa: '' }
  }
  // Katalog roboczy zostaje dla zrzutów i logów Maestro, ale bez zapisu komend: `commands-*.json` niesie wartości zmiennych flow, także te ze środowiska.
  usunZapisKomend(robocze)
  const natywny = /cannot find native module/i.test(ogon) ? ' Komunikat o module natywnym oznacza przestarzały dev-client: przebuduj go.' : ''
  return { ok: false, detal: `canary na ${urzadzenie.nazwa}: kod ${kod}\n${ogon}`, naprawa: `Sprawdź ręcznie: maestro --device ${urzadzenie.id} test ${wlasny ? PLIK_CANARY : '<flow>'}.${natywny}` }
}

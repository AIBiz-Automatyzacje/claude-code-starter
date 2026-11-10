// Adapter E2E stacku Expo (Metro, dev-client, Maestro): slot plikowy z rejestru stacks/sloty.json, kontrakt w wariancie web tego pliku
// i w __tests__/adapter.test.mjs. Logika z promptu env-up starego szablonu mobile, przeniesiona do skryptu. Moduły pomocnicze:
// expo-env.mjs (D13), expo-urzadzenie.mjs (iOS najpierw, dev-client), expo-canary.mjs (reload, dowód Maestro).

import { spawnSync } from 'node:child_process'
import { existsSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PLIK_CANARY, przejdzCanary, wyslijReload } from './expo-canary.mjs'
import { cofnijEnvE2e, PLIK_DEV, plikAdaptera, zapiszEnvE2e } from './expo-env.mjs'
import { uwagaPaczekSdk } from './expo-paczki.mjs'
import { trasyExpoRouter } from './expo-trasy.mjs'
import { aplikacjaProjektu, OSTRZEZENIE_CLEAN, przygotujUrzadzenie, REBUILD, UWAGA_PODPISU_IOS, zrzutEkranu } from './expo-urzadzenie.mjs'

/** @typedef {{ ok: boolean, detal: string }} WynikNarzedzia */
/** @typedef {{ ok: boolean, detal: string, naprawa: string, przebudowa?: boolean }} WynikKroku */
/**
 * @typedef {{ wzorzec: string, flagi: string, klasa: string, polityka: 'manual-restart' | 'stop-rebuild', naprawa: string }} SygnaturaBlokera
 */

// Obcy Metro na porcie może serwować paczkę innego projektu (D11), a dev-client i tak łączy się z tym portem.
/** @type {'stop' | 'zastap'} */
export const POLITYKA_OBCEGO = 'zastap'

const NAPRAWA_REBUILDU = `Przebuduj dev-client: iOS \`${REBUILD.ios}\`, Android \`${REBUILD.android}\`. ${OSTRZEZENIE_CLEAN} ${UWAGA_PODPISU_IOS}`
// Brak modułu natywnego albo entitlements nie znika po restarcie Metro: bez przebudowy każdy kolejny scenariusz padnie tak samo (D12).
/** @type {SygnaturaBlokera[]} */
export const SYGNATURY_BLOKERA = [
  { wzorzec: 'cannot find native module|requireNativeModule[^\\n]*not found|TurboModuleRegistry\\.getEnforcing[^\\n]*could not be found', flagi: 'i', klasa: 'brak-modulu-natywnego', polityka: 'stop-rebuild', naprawa: NAPRAWA_REBUILDU },
  { wzorzec: 'SecureStore[^\\n]*(?:permission|entitlement|keychain)|errSecMissingEntitlement|-34018', flagi: 'i', klasa: 'brak-entitlements', polityka: 'stop-rebuild', naprawa: NAPRAWA_REBUILDU },
]

export const DOMYSLNY_PORT = 8081
// `/status` odpowiada od razu. Korzeń `/` każe Expo budować paczkę web, a aplikacja bez wariantu web może na nim odpowiedzieć błędem.
export const SCIEZKA_ZDROWIA = '/status'
// Metro E2E i zwykłe Metro to ten sam port, bo dev-client łączy się z 8081: obcy proces obsługuje POLITYKA_OBCEGO.
export const PORT_DEV = null
export const OPIS_PORTU_DEV = ''

const URUCHOM_EXPO = /** @type {Record<string, string>} */ ({ bun: 'bunx expo', pnpm: 'pnpm exec expo', yarn: 'yarn expo', npm: 'npx expo' })

// `env -u CI`: przy CI=1 Metro wyłącza obserwację plików i zapis env nie dociera do paczki (spike SDK 58, pkt 5).
/** @param {string} pm menedżer pakietów @param {number | string} port @returns {string} */
export const komendaStartu = (pm, port) => `env -u CI ${URUCHOM_EXPO[pm] ?? 'npx expo'} start --port ${port}`

// Instalacja bez potoku: doctor pokazuje ją w tabeli rozdzielanej znakiem `|`.
export const NARZEDZIE_JAZDY = { nazwa: 'maestro', instalacja: 'curl -fsSLo /tmp/maestro-install.sh "https://get.maestro.mobile.dev" && bash /tmp/maestro-install.sh (wymaga Java 17+)', diagnoza: 'maestro --version && java -version' }

const MINIMALNA_JAVA = 17

/** @param {string} tekst wyjście `java -version` @returns {number | null} */
export function wersjaJavy(tekst) {
  const m = /version "(\d+)(?:\.(\d+))?/.exec(tekst)
  if (!m) return null
  return m[1] === '1' ? Number(m[2]) : Number(m[1])
}

/** @returns {WynikNarzedzia} */
export function sprawdzNarzedzie() {
  const maestro = spawnSync('maestro', ['--version'], { encoding: 'utf8' })
  if (maestro.error) return { ok: false, detal: `brak maestro (${maestro.error.message})` }
  if (maestro.status !== 0) return { ok: false, detal: `maestro --version: kod ${maestro.status}` }
  const java = spawnSync('java', ['-version'], { encoding: 'utf8' })
  const wersja = java.error ? null : wersjaJavy(`${java.stderr}${java.stdout}`)
  if (wersja === null) return { ok: false, detal: 'brak Java: Maestro wymaga Java 17+' }
  return wersja >= MINIMALNA_JAVA ? { ok: true, detal: '' } : { ok: false, detal: `Java ${wersja}: Maestro wymaga Java ${MINIMALNA_JAVA}+` }
}

export const LIMIT_ZRZUTU_SEK = 30
export const opisProbyZrzutu = `probny zrzut ekranu urzadzenia (limit ${LIMIT_ZRZUTU_SEK} s)`
export const naprawaZrzutu = 'Sprawdz, czy urzadzenie dziala: `xcrun simctl list devices booted` albo `adb devices`, i zrob zrzut recznie.'

/** @type {{ urzadzenie: import('./expo-urzadzenie.mjs').Urzadzenie, aplikacja: import('./expo-urzadzenie.mjs').Aplikacja } | null} */
let przygotowane = null

/**
 * Próbny zrzut urządzenia wybranego w `przedStartem`. Bez wyboru (repo bez aplikacji) nie ma czego sprawdzać.
 * @returns {WynikNarzedzia}
 */
export function probnyZrzut() {
  if (!przygotowane) return { ok: true, detal: '' }
  const plik = join(tmpdir(), `autopilot-e2e-proba-${process.pid}.png`)
  const w = zrzutEkranu(przygotowane.urzadzenie, plik, LIMIT_ZRZUTU_SEK * 1000)
  const pelny = przygotowane.urzadzenie.platforma === 'android' || (existsSync(plik) && statSync(plik).size > 0)
  rmSync(plik, { force: true })
  if (w.blad) return { ok: false, detal: `nie skonczyl sie w ${LIMIT_ZRZUTU_SEK} s` }
  return w.status === 0 && pelny ? { ok: true, detal: '' } : { ok: false, detal: `kod ${w.status}: ${w.stderr.trim().split('\n').pop() ?? ''}` }
}

/**
 * Krok przed serwerem: urządzenie z aktualnym dev-clientem, potem zapis zmiennych klienta. Repo bez konfiguracji Expo (projekt od zera,
 * start odroczony) nic tu nie robi, a pierwsza faza z aplikacją przechodzi ten krok w restarcie.
 * @param {string} projekt @param {Record<string, string>} env @returns {WynikKroku}
 */
export function przedStartem(projekt, env) {
  const aplikacja = aplikacjaProjektu(projekt)
  if (!aplikacja) return { ok: true, detal: '', naprawa: '' }
  const wynik = przygotujUrzadzenie(projekt, aplikacja, env)
  if (!wynik.ok) return wynik
  const zapis = zapiszEnvE2e(projekt)
  if (!zapis.ok) return zapis
  przygotowane = { urzadzenie: wynik.urzadzenie, aplikacja }
  return { ok: true, detal: [`${wynik.urzadzenie.platforma} ${wynik.urzadzenie.nazwa}`, zapis.detal, ...wynik.uwagi].join('; '), naprawa: '' }
}

/**
 * Krok po odpowiedzi serwera: reload (docs Expo wymagają go po zmianie env) i dowód canary. Porażka reloadu to tylko uwaga: canary
 * i tak uruchamia aplikację od nowa.
 * @param {string} projekt @param {Record<string, string>} env @param {{ port: number }} konf @returns {Promise<WynikKroku>}
 */
export async function poStarcie(projekt, env, konf) {
  if (!przygotowane) return { ok: true, detal: '', naprawa: '' }
  const reload = await wyslijReload(konf.port)
  const canary = await przejdzCanary(projekt, env, { port: konf.port, ...przygotowane })
  return reload.ok ? canary : { ...canary, detal: `${canary.detal}; reload: ${reload.detal}` }
}

/** @param {string} projekt @returns {{ detal: string }} */
export const poZatrzymaniu = (projekt) => cofnijEnvE2e(projekt)

/** @param {string} projekt @returns {[string, string, string, string] | null} wiersz doctora: pozostawiony plik env przykrywa dev bez sygnału (D13) */
export function uwagaDoctora(projekt) {
  if (!plikAdaptera(projekt)) return null
  return ['env E2E', 'UWAGA', `${PLIK_DEV} z przebiegu E2E przykrywa .env.local: aplikacja w dev celuje w bazę e2e`, 'node .claude/scripts/e2e/e2e.mjs stop (po zakończonym przebiegu)']
}

/** @type {(projekt: string, env: Record<string, string>) => string[]} */
export const uwagiPlanowania = (projekt) => {
  const uwagi = []
  if (plikAdaptera(projekt)) uwagi.push(`${PLIK_DEV} z poprzedniego przebiegu E2E przykrywa .env.local; po zakończonym przebiegu: node .claude/scripts/e2e/e2e.mjs stop`)
  const expo = ['app.json', 'app.config.js', 'app.config.ts'].some((p) => existsSync(join(projekt, p)))
  if (expo && !existsSync(join(projekt, PLIK_CANARY))) uwagi.push(`brak ${PLIK_CANARY}: canary dowodzi tylko, że aplikacja wstaje, nie że flow za logowaniem ruszy (wzór: .claude/templates/e2e-env/_canary.yaml)`)
  const paczki = expo ? uwagaPaczekSdk(projekt) : null
  if (paczki) uwagi.push(paczki)
  return uwagi
}

// Szkielet skilla weryfikacji projektu (szkielet.mjs, /weryfikacja-setup): komendy narzędzia jazdy w sekcjach skilla.
export const SZKIELET_WERYFIKACJI = {
  domyslneParametry: 'domyślne (Metro na 8081)',
  obcySerwer: 'Proces spoza pipeline’u na tym porcie (np. zwykłe `expo start`)\nLaunch zatrzymuje i stawia własne Metro: obce mogłoby serwować paczkę innego projektu.',
  doctor: '`maestro --version`, `xcrun simctl list devices booted` albo `adb devices`',
  gdzieJazda: 'na urządzeniu',
  atrybutSelektora: 'testID',
  trasyZPlikow: trasyExpoRouter,
  drive: 'Urządzenie: skill `mobile-e2e-maestro`: flow `.maestro/<flow>.yaml` przez `node .claude/scripts/e2e/expo-flow.mjs --zadanie <folder zadania> --flow <flow>`.',
  /** @param {number} testId liczba atrybutów testID w kodzie @returns {string} */
  selektory: (testId) => (testId
    ? `Selektory: kod ma ${testId} atrybutów \`testID\`: w flow wskazuj je polem \`id\`.`
    : 'Selektory: kod nie ma atrybutów `testID`: elementy wskazuj widocznym tekstem.'),
  evidence: [
    'Dowód scenariusza = status flow + stan po akcji + skutek uboczny. Stan: `assertVisible` i `takeScreenshot` w flow, uruchomionym przez',
    '`node .claude/scripts/e2e/expo-flow.mjs --zadanie <folder zadania> --flow <flow>`: zrzuty idą do `<folder zadania>/maestro/<flow>`, a zapis komend z hasłem zostaje poza repo. Skutek uboczny (zapis, wysyłka): wiersz bazy e2e.',
  ].join('\n'),
  cleanup: 'Urządzenie zostaje włączone. `node .claude/scripts/e2e/e2e.mjs stop` zatrzymuje Metro i sprząta plik env.',
}

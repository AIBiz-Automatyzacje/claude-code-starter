// Urządzenie i dev-client dla E2E na Expo: iOS najpierw, Android jako zapas (A0.1 #7–9). Na iOS odpada symulator z zalogowanym kontem
// Apple, bo monit „Weryfikacja konta Apple” zasłania aplikację i nie zamyka się wstrzykniętym dotknięciem (spike SDK 58). Dev-client
// starszy od konfiguracji natywnej albo bez podpisu to STOP: bez tego aplikacja pada dopiero w środku scenariusza.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { zmianyNatywne } from './expo-natywne.mjs'

/**
 * @typedef {{ status: number | null, stdout: string, stderr: string, blad?: boolean }} WynikKomendy
 * @typedef {(komenda: string, argumenty: string[], opcje?: { cwd?: string, limitMs?: number }) => WynikKomendy} Wykonaj
 * @typedef {{ bundleId: string | null, appId: string | null, scheme: string | null }} Aplikacja
 * @typedef {{ platforma: 'ios' | 'android', id: string, nazwa: string, sciezkaAplikacji: string | null }} Urzadzenie
 * @typedef {{ ok: false, detal: string, naprawa: string, przebudowa?: boolean }} PorazkaUrzadzenia
 * @typedef {{ ok: true, urzadzenie: Urzadzenie, uwagi: string[] } | PorazkaUrzadzenia} WynikUrzadzenia
 * @typedef {{ udid: string, name: string, state: string, dataPath: string, isAvailable: boolean, deviceTypeIdentifier?: string }} Symulator
 */

const LIMIT_KOMENDY_MS = 30_000
const LIMIT_BOOTU_MS = 180_000
const KONTO_APPLE = 'com.apple.account.AppleAccount'
const LOCKFILES = ['bun.lock', 'bun.lockb', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json']
const KONFIGURACJA = ['app.json', 'app.config.js', 'app.config.ts', ...LOCKFILES]
// Pliki natywne tylko swojej platformy: nowszy ios/Podfile.lock nie unieważnia binarki Androida.
const NATYWNE = { ios: 'ios/Podfile.lock', android: 'android/build.gradle' }
// package.json celowo pominięty: jego mtime przestawia każdy checkout i edycja `scripts`.

// `expo run:*` robi prebuild tylko przy braku katalogu natywnego, a docs Expo zalecają `--clean` po zmianie pluginów albo paczki natywnej.
// LANG: CocoaPods w powłoce bez locale pada na `Unicode Normalization not appropriate for ASCII-8BIT`.
export const REBUILD = {
  ios: 'LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios && LANG=en_US.UTF-8 npx expo run:ios --no-bundler',
  android: 'npx expo prebuild --clean --platform android && npx expo run:android --no-bundler',
}
// Operator wkleja komendę ze STOP-u, więc ostrzeżenie idzie w treści naprawy, nie tylko w slocie po-fazie.md, który ma to samo zdanie.
export const OSTRZEZENIE_CLEAN = '`--clean` usuwa `ios/` i `android/`. Projekt, który trzyma te katalogi w repo, pomija `prebuild` i woła samo `expo run:*`.'
// Sign in with Apple albo associated domains: Expo CLI żąda podpisu także dla symulatora i bez certyfikatu Apple kończy
// `No code signing certificates are available to use` (pilot Nawykometr). Podpis ad-hoc (`CODE_SIGN_IDENTITY=-`) zostawia entitlements,
// więc SecureStore utrzyma sesję; `CODE_SIGNING_ALLOWED=NO` je gubi.
export const REBUILD_IOS_ADHOC = 'LANG=en_US.UTF-8 npx expo prebuild --clean --platform ios && LANG=en_US.UTF-8 xcodebuild -workspace ios/<Aplikacja>.xcworkspace '
  + '-scheme <Aplikacja> -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build CODE_SIGN_IDENTITY=- build && '
  + 'xcrun simctl install <UDID> ios/build/Build/Products/Debug-iphonesimulator/<Aplikacja>.app'
export const UWAGA_PODPISU_IOS = 'Gdy `expo run:ios` kończy się `No code signing certificates are available to use` (Sign in with Apple albo associated '
  + `domains bez certyfikatu Apple), zbuduj z podpisem ad-hoc: \`${REBUILD_IOS_ADHOC}\` (<Aplikacja> = nazwa \`ios/*.xcworkspace\`; `
  + 'bez `CODE_SIGNING_ALLOWED=NO`, bo binarka straci entitlements).'
const ODPAD_ANDROIDA = {
  'bez-emulatora': 'Android: brak działającego emulatora',
  'bez-dev-clienta': 'Android: działający emulator bez dev-clienta',
}

/** @type {Wykonaj} */
export function wykonaj(komenda, argumenty, { cwd, limitMs = LIMIT_KOMENDY_MS } = {}) {
  const w = spawnSync(komenda, argumenty, { encoding: 'utf8', cwd, timeout: limitMs, killSignal: 'SIGKILL' })
  return { status: w.status, stdout: w.stdout ?? '', stderr: w.stderr ?? '', blad: !!w.error }
}

/** @param {unknown} x @returns {Record<string, unknown>} */
const rekord = (x) => (x && typeof x === 'object' ? /** @type {Record<string, unknown>} */ (x) : {})
/** @param {unknown} x @returns {string | null} */
const napis = (x) => (typeof x === 'string' && x ? x : null)

/** @param {unknown} konfig konfiguracja `expo` @returns {Aplikacja} */
function polaAplikacji(konfig) {
  const expo = rekord(konfig)
  const scheme = Array.isArray(expo.scheme) ? expo.scheme[0] : expo.scheme
  return { bundleId: napis(rekord(expo.ios).bundleIdentifier), appId: napis(rekord(expo.android).package), scheme: napis(scheme) }
}

/**
 * Identyfikatory aplikacji: app.json, a przy app.config.* konfiguracja policzona przez Expo CLI projektu.
 * @param {string} projekt @param {Wykonaj} [wykonajKomende] @returns {Aplikacja | null} null: repo bez konfiguracji Expo
 */
export function aplikacjaProjektu(projekt, wykonajKomende = wykonaj) {
  const appJson = join(projekt, 'app.json')
  const zPliku = existsSync(appJson) ? polaAplikacji(rekord(JSON.parse(readFileSync(appJson, 'utf8'))).expo) : null
  if (zPliku?.bundleId && zPliku.appId) return zPliku
  if (!['app.config.js', 'app.config.ts'].some((p) => existsSync(join(projekt, p)))) return zPliku
  const w = wykonajKomende(join(projekt, 'node_modules/.bin/expo'), ['config', '--json'], { cwd: projekt })
  return w.status === 0 ? polaAplikacji(JSON.parse(w.stdout)) : zPliku
}

/**
 * Zalogowane konto Apple na symulatorze: wpis w bazie kont, odczyt tylko typów, bez danych konta.
 * @param {string} dataPath @param {Wykonaj} [wykonajKomende] @returns {boolean | null} null: nie udało się sprawdzić
 */
export function maKontoApple(dataPath, wykonajKomende = wykonaj) {
  const katalog = join(dataPath, 'Library/Accounts')
  const baza = existsSync(katalog) ? readdirSync(katalog).find((p) => /^Accounts\d+\.sqlite$/.test(p)) : undefined
  if (!baza) return null
  const zapytanie = `select count(*) from ZACCOUNT a join ZACCOUNTTYPE t on a.ZACCOUNTTYPE = t.Z_PK where t.ZIDENTIFIER = '${KONTO_APPLE}'`
  const w = wykonajKomende('sqlite3', [`file:${join(katalog, baza)}?mode=ro`, zapytanie])
  return w.status === 0 ? Number(w.stdout.trim()) > 0 : null
}

/**
 * Dev-client na wyłączonym symulatorze: simctl pyta tylko włączone urządzenia, więc czytamy metadane kontenerów z dysku.
 * @param {string} dataPath @param {string} bundleId @returns {boolean}
 */
function zainstalowanaNaDysku(dataPath, bundleId) {
  const katalog = join(dataPath, 'Containers/Bundle/Application')
  if (!existsSync(katalog)) return false
  return readdirSync(katalog).some((k) => {
    const meta = join(katalog, k, '.com.apple.mobile_container_manager.metadata.plist')
    return existsSync(meta) && readFileSync(meta).includes(bundleId)
  })
}

/** @param {Wykonaj} wykonajKomende @returns {Symulator[]} iPhone'y dostępne w simctl */
function symulatory(wykonajKomende) {
  const w = wykonajKomende('xcrun', ['simctl', 'list', 'devices', 'available', '-j'])
  if (w.status !== 0) return []
  const urzadzenia = /** @type {Record<string, Symulator[]>} */ (rekord(rekord(JSON.parse(w.stdout)).devices))
  return Object.values(urzadzenia).flat().filter((s) => /iPhone/.test(s.deviceTypeIdentifier ?? s.name))
}

/**
 * @param {string} projekt @param {number} mtimeBinarki sekundy @param {'ios' | 'android'} platforma
 * @returns {string | null} plik nowszy od binarki
 */
export function przestarzaly(projekt, mtimeBinarki, platforma) {
  for (const plik of [NATYWNE[platforma], ...KONFIGURACJA]) {
    const sciezka = join(projekt, plik)
    if (existsSync(sciezka) && statSync(sciezka).mtimeMs / 1000 > mtimeBinarki) return plik
  }
  return null
}

/**
 * Podpis dev-clienta iOS. Niepodpisany build działa, ale SecureStore nie utrwala sesji, więc logowanie „przechodzi”, a kolejny flow
 * startuje wylogowany. Warunek nie zależy od uprawnień w app.json: keychain-access-groups wstrzykuje Xcode przy podpisywaniu.
 * @param {string} sciezka .app @param {Wykonaj} wykonajKomende @returns {boolean}
 */
export function podpisany(sciezka, wykonajKomende = wykonaj) {
  const w = wykonajKomende('codesign', ['-d', '--entitlements', '-', '--xml', sciezka])
  return w.status === 0 && !/not signed at all/.test(`${w.stdout}${w.stderr}`)
}

/**
 * Świeżość binarki: nowszy plik natywny to STOP od razu, a nowszy lockfile albo app.json rozstrzyga diff od builda (bramka natywna).
 * @param {string} projekt @param {number} mtime sekundy @param {'ios' | 'android'} platforma @param {string} nazwa
 * @returns {{ stop: PorazkaUrzadzenia | null, uwaga: string | null }}
 */
function ocenaSwiezosci(projekt, mtime, platforma, nazwa) {
  const stary = przestarzaly(projekt, mtime, platforma)
  if (!stary) return { stop: null, uwaga: null }
  const zmiany = stary === NATYWNE[platforma] ? null : zmianyNatywne(projekt, mtime)
  if (zmiany && !zmiany.wymagaRebuildu) return { stop: null, uwaga: `dev-client na ${nazwa} starszy niż ${stary}, ale przebudowa niepotrzebna: ${zmiany.detal}` }
  const powod = zmiany ? zmiany.detal : 'warstwa natywna zmieniona po buildzie'
  return { stop: { ok: false, detal: `dev-client na ${nazwa} starszy niż ${stary}: ${powod}`, naprawa: `Przebuduj: ${REBUILD[platforma]}. ${OSTRZEZENIE_CLEAN}${platforma === 'ios' ? ` ${UWAGA_PODPISU_IOS}` : ''}`, przebudowa: true }, uwaga: null }
}

/** @param {Symulator} s @param {Wykonaj} wykonajKomende @returns {{ ok: boolean, detal: string }} */
function wlaczony(s, wykonajKomende) {
  if (s.state === 'Booted') return { ok: true, detal: '' }
  const boot = wykonajKomende('xcrun', ['simctl', 'boot', s.udid])
  if (boot.status !== 0) return { ok: false, detal: `simctl boot ${s.name}: ${boot.stderr.trim()}` }
  const stan = wykonajKomende('xcrun', ['simctl', 'bootstatus', s.udid, '-b'], { limitMs: LIMIT_BOOTU_MS })
  return stan.status === 0 ? { ok: true, detal: '' } : { ok: false, detal: `${s.name} nie wystartował w ${LIMIT_BOOTU_MS / 1000} s` }
}

/**
 * iPhone do E2E: E2E_URZADZENIE (nazwa albo UDID) albo pierwszy bez konta Apple z dev-clientem, włączone najpierw.
 * @param {string} bundleId @param {string | undefined} wskazane @param {Wykonaj} wykonajKomende @param {boolean} tylkoWlaczone
 * @returns {{ symulator: Symulator | null, uwagi: string[], odpady: string[], bezDevClienta: boolean }}
 */
function wybierzSymulator(bundleId, wskazane, wykonajKomende, tylkoWlaczone) {
  const lista = symulatory(wykonajKomende).filter((s) => (!wskazane || s.udid === wskazane || s.name === wskazane) && (!tylkoWlaczone || s.state === 'Booted'))
  const odpady = []
  const uwagi = []
  const dobre = []
  let bezDevClienta = false
  for (const s of lista) {
    const konto = maKontoApple(s.dataPath, wykonajKomende)
    if (konto) odpady.push(`${s.name}: zalogowane konto Apple`)
    else if (!zainstalowanaNaDysku(s.dataPath, bundleId)) {
      odpady.push(`${s.name}: brak dev-clienta`)
      bezDevClienta = true
    } else {
      if (konto === null) uwagi.push(`${s.name}: nie sprawdzono konta Apple`)
      dobre.push(s)
    }
  }
  dobre.sort((a, b) => Number(b.state === 'Booted') - Number(a.state === 'Booted'))
  return { symulator: dobre[0] ?? null, uwagi, odpady, bezDevClienta }
}

/**
 * @param {string} projekt @param {Aplikacja} aplikacja @param {Symulator} s @param {string[]} uwagi @param {Wykonaj} wykonajKomende
 * @returns {WynikUrzadzenia}
 */
function sprawdzIos(projekt, aplikacja, s, uwagi, wykonajKomende) {
  const start = wlaczony(s, wykonajKomende)
  if (!start.ok) return { ok: false, detal: start.detal, naprawa: `Uruchom symulator ręcznie: xcrun simctl boot ${s.udid}` }
  const kontener = wykonajKomende('xcrun', ['simctl', 'get_app_container', s.udid, String(aplikacja.bundleId)])
  const sciezka = kontener.stdout.trim()
  if (kontener.status !== 0 || !sciezka) return { ok: false, detal: `${s.name}: brak dev-clienta ${aplikacja.bundleId}`, naprawa: `Zainstaluj dev-client: ${REBUILD.ios}. ${OSTRZEZENIE_CLEAN}`, przebudowa: true }
  const swiezosc = ocenaSwiezosci(projekt, statSync(sciezka).mtimeMs / 1000, 'ios', s.name)
  if (swiezosc.stop) return swiezosc.stop
  if (!podpisany(sciezka, wykonajKomende)) return { ok: false, detal: `dev-client na ${s.name} bez podpisu: SecureStore nie utrwali sesji`, naprawa: `Przebuduj z podpisem ad-hoc: ${REBUILD.ios}. ${OSTRZEZENIE_CLEAN}`, przebudowa: true }
  return { ok: true, urzadzenie: { platforma: 'ios', id: s.udid, nazwa: s.name, sciezkaAplikacji: sciezka }, uwagi: swiezosc.uwaga ? [...uwagi, swiezosc.uwaga] : uwagi }
}

/**
 * Android: tylko emulator już działający. Odczyt mtime bywa niedostępny (`Permission denied`) i wtedy kontrola świeżości odpada z uwagą.
 * @param {string} projekt @param {Aplikacja} aplikacja @param {string | undefined} wskazane @param {Wykonaj} wykonajKomende
 * @returns {WynikUrzadzenia | keyof typeof ODPAD_ANDROIDA}
 */
function sprawdzAndroid(projekt, aplikacja, wskazane, wykonajKomende) {
  const lista = wykonajKomende('adb', ['devices'])
  if (lista.status !== 0 || !aplikacja.appId) return 'bez-emulatora'
  const seriale = lista.stdout.split('\n').map((l) => l.match(/^(\S+)\s+device$/)?.[1]).filter((s) => s && (!wskazane || s === wskazane))
  for (const id of /** @type {string[]} */ (seriale)) {
    const sciezka = wykonajKomende('adb', ['-s', id, 'shell', 'pm', 'path', aplikacja.appId]).stdout.trim().split('\n')[0].replace(/^package:/, '')
    if (!sciezka) continue
    const urzadzenie = /** @type {Urzadzenie} */ ({ platforma: 'android', id, nazwa: id, sciezkaAplikacji: sciezka })
    const mtime = Number(wykonajKomende('adb', ['-s', id, 'shell', 'stat', '-c', '%Y', sciezka]).stdout.trim())
    if (!Number.isFinite(mtime) || mtime <= 0) return { ok: true, urzadzenie, uwagi: [`${id}: nie sprawdzono świeżości dev-clienta (brak odczytu mtime)`] }
    const swiezosc = ocenaSwiezosci(projekt, mtime, 'android', id)
    if (swiezosc.stop) return swiezosc.stop
    return { ok: true, urzadzenie, uwagi: swiezosc.uwaga ? [swiezosc.uwaga] : [] }
  }
  return seriale.length > 0 ? 'bez-dev-clienta' : 'bez-emulatora'
}

/**
 * Naprawa braku urządzenia. Przebudowa tylko przy stwierdzonym braku dev-clienta: wyłączone urządzenie wystarczy włączyć, a jego
 * dev-client sprawdzi następny start.
 * @param {string | undefined} platforma @param {boolean} bezDevClienta @returns {string}
 */
function naprawaBrakuUrzadzenia(platforma, bezDevClienta) {
  const ios = bezDevClienta
    ? `iOS: zainstaluj dev-client na symulatorze bez konta Apple (${REBUILD.ios}, wybór urządzenia: E2E_URZADZENIE w .env.e2e). ${UWAGA_PODPISU_IOS}`
    : 'iOS: włącz symulator bez konta Apple (xcrun simctl boot <nazwa>, wybór urządzenia: E2E_URZADZENIE w .env.e2e).'
  const android = bezDevClienta
    ? `Android: uruchom emulator (emulator -avd <nazwa>) i ${REBUILD.android}.`
    : 'Android: uruchom emulator (emulator -avd <nazwa>).'
  const czesci = [...(platforma === 'android' ? [] : [ios]), ...(platforma === 'ios' ? [] : [android])]
  return [...czesci, ...(bezDevClienta ? [OSTRZEZENIE_CLEAN] : [])].join(' ')
}

/**
 * Wybór urządzenia: E2E_PLATFORMA (`ios` albo `android`) i E2E_URZADZENIE z .env.e2e, inaczej iOS, a przy braku Android.
 * @param {string} projekt @param {Aplikacja} aplikacja @param {Record<string, string>} env @param {Wykonaj} [wykonajKomende]
 * @param {{ tylkoWlaczone?: boolean }} [opcje] tylkoWlaczone: ten sam wybór bez włączania symulatora; tester nie bootuje urządzeń
 * @returns {WynikUrzadzenia}
 */
export function przygotujUrzadzenie(projekt, aplikacja, env, wykonajKomende = wykonaj, { tylkoWlaczone = false } = {}) {
  const platforma = env.E2E_PLATFORMA
  if (platforma && !['ios', 'android'].includes(platforma)) return { ok: false, detal: `E2E_PLATFORMA=${platforma}`, naprawa: 'Dozwolone wartości E2E_PLATFORMA: ios, android.' }
  const wskazane = env.E2E_URZADZENIE || undefined
  const odpady = []
  let bezDevClienta = false
  if (platforma !== 'android' && aplikacja.bundleId) {
    const wybor = wybierzSymulator(aplikacja.bundleId, wskazane, wykonajKomende, tylkoWlaczone)
    if (wybor.symulator) return sprawdzIos(projekt, aplikacja, wybor.symulator, wybor.uwagi, wykonajKomende)
    odpady.push(...wybor.odpady)
    bezDevClienta = wybor.bezDevClienta
  }
  if (platforma !== 'ios') {
    const android = sprawdzAndroid(projekt, aplikacja, wskazane, wykonajKomende)
    if (typeof android !== 'string') return android
    odpady.push(ODPAD_ANDROIDA[android])
    bezDevClienta ||= android === 'bez-dev-clienta'
  }
  const porazka = {
    ok: /** @type {const} */ (false),
    detal: `brak urządzenia do E2E (${odpady.join('; ') || 'brak iPhone w simctl'})`,
    naprawa: naprawaBrakuUrzadzenia(platforma, bezDevClienta),
  }
  return bezDevClienta ? { ...porazka, przebudowa: true } : porazka
}

/**
 * Zrzut ekranu urządzenia.
 * @param {Urzadzenie} u @param {string} plik @param {number} limitMs @param {Wykonaj} [wykonajKomende] @returns {WynikKomendy}
 */
export function zrzutEkranu(u, plik, limitMs, wykonajKomende = wykonaj) {
  if (u.platforma === 'ios') return wykonajKomende('xcrun', ['simctl', 'io', u.id, 'screenshot', plik], { limitMs })
  return wykonajKomende('adb', ['-s', u.id, 'exec-out', 'screencap', '-p'], { limitMs })
}

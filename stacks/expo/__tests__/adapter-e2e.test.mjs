// Adapter E2E Expo (IU-2.3, D11, D12, D13): plik env, wybór urządzenia, dev-client, canary, profil i szablony. Moduły biegną z ławki,
// bo w nakładce względne importy do rdzenia się nie rozwiązują. Komendy systemowe są atrapami; jazdę na symulatorze i emulatorze opisuje plan.
//
// Uruchomienie: node --test stacks/expo/__tests__/adapter-e2e.test.mjs

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test, { after } from 'node:test'
import assert from 'node:assert/strict'

import { przygotujLawke } from '../../testuj-wariant.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const { katalog: WARIANT, sprzataj } = przygotujLawke(KORZEN, 'expo')
after(sprzataj)

/** @param {string} plik wzgledem .claude/scripts/e2e */
const modul = (plik) => import(pathToFileURL(join(WARIANT, '.claude/scripts/e2e', plik)).href)
const adapter = await modul('adapter.mjs')
const env = await modul('expo-env.mjs')
const urzadzenie = await modul('expo-urzadzenie.mjs')
const canary = await modul('expo-canary.mjs')
const natywne = await modul('expo-natywne.mjs')
/** @param {string} sciezka */
const czytaj = (sciezka) => readFileSync(join(WARIANT, sciezka), 'utf8')

/** @returns {string} */
const katalog = () => mkdtempSync(join(tmpdir(), 'expo-e2e-'))
const IGNOROWANE = { czyIgnorowany: () => true }

// --- plik env (D13) ---

test('env: zapisuje tylko linie EXPO_PUBLIC_* dosłownie, ze znacznikiem; sekrety bazy zostają poza plikiem', () => {
  const p = katalog()
  writeFileSync(join(p, '.env.e2e'), 'SUPABASE_E2E_SERVICE_ROLE_KEY=tajne\n# EXPO_PUBLIC_KOMENTARZ=x\nEXPO_PUBLIC_A=https://e2e.example\nexport EXPO_PUBLIC_B="z spacja"\nE2E_TEST_PASSWORD=haslo\n')
  const w = env.zapiszEnvE2e(p, IGNOROWANE)
  assert.equal(w.ok, true)
  assert.equal(readFileSync(join(p, env.PLIK_DEV), 'utf8'), `${env.ZNACZNIK}\nEXPO_PUBLIC_A=https://e2e.example\nexport EXPO_PUBLIC_B="z spacja"\n`)
  assert.equal(env.plikAdaptera(p), true)
})

test('env: plik poza .gitignore = STOP bez zapisu; sprawdzenie na prawdziwym git', () => {
  const p = katalog()
  spawnSync('git', ['init', '-q'], { cwd: p })
  writeFileSync(join(p, '.env.e2e'), 'EXPO_PUBLIC_A=1\n')
  const bez = env.zapiszEnvE2e(p)
  assert.equal(bez.ok, false)
  assert.match(bez.detal, /\.env\.development\.local, \.env\.kopia-e2e\.local poza \.gitignore/)
  assert.equal(existsSync(join(p, env.PLIK_DEV)), false)
  writeFileSync(join(p, '.gitignore'), '.env*.local\n')
  assert.equal(env.zapiszEnvE2e(p).ok, true)
})

test('env: plik operatora dostaje kopię i wraca po cofnięciu; .env.local nietknięty', () => {
  const p = katalog()
  writeFileSync(join(p, '.env.e2e'), 'EXPO_PUBLIC_A=e2e\n')
  writeFileSync(join(p, '.env.local'), 'EXPO_PUBLIC_A=dev\n')
  writeFileSync(join(p, env.PLIK_DEV), 'EXPO_PUBLIC_A=operator\n')
  const w = env.zapiszEnvE2e(p, IGNOROWANE)
  assert.match(w.detal, /plik operatora w \.env\.kopia-e2e\.local/)
  assert.equal(readFileSync(join(p, env.PLIK_KOPII), 'utf8'), 'EXPO_PUBLIC_A=operator\n')
  assert.match(env.cofnijEnvE2e(p).detal, /operatora przywrócony/)
  assert.equal(readFileSync(join(p, env.PLIK_DEV), 'utf8'), 'EXPO_PUBLIC_A=operator\n')
  assert.equal(existsSync(join(p, env.PLIK_KOPII)), false)
  assert.equal(readFileSync(join(p, '.env.local'), 'utf8'), 'EXPO_PUBLIC_A=dev\n')
})

test('env: pozostałość po przebiegu nadpisana i nazwana; plik operatora obok kopii = STOP bez zmian', () => {
  const p = katalog()
  writeFileSync(join(p, '.env.e2e'), 'EXPO_PUBLIC_A=nowe\n')
  writeFileSync(join(p, env.PLIK_DEV), `${env.ZNACZNIK}\nEXPO_PUBLIC_A=stare\n`)
  assert.match(env.zapiszEnvE2e(p, IGNOROWANE).detal, /nadpisana pozostałość/)
  assert.match(readFileSync(join(p, env.PLIK_DEV), 'utf8'), /EXPO_PUBLIC_A=nowe/)
  assert.equal(existsSync(join(p, env.PLIK_KOPII)), false)
  const q = katalog()
  writeFileSync(join(q, '.env.e2e'), 'EXPO_PUBLIC_A=e2e\n')
  writeFileSync(join(q, env.PLIK_DEV), 'EXPO_PUBLIC_A=operator\n')
  writeFileSync(join(q, env.PLIK_KOPII), 'EXPO_PUBLIC_A=kopia\n')
  assert.equal(env.zapiszEnvE2e(q, IGNOROWANE).ok, false)
  assert.equal(readFileSync(join(q, env.PLIK_DEV), 'utf8'), 'EXPO_PUBLIC_A=operator\n')
  assert.equal(readFileSync(join(q, env.PLIK_KOPII), 'utf8'), 'EXPO_PUBLIC_A=kopia\n')
})

test('env: cofnięcie nie rusza pliku bez znacznika; bez plików nic nie robi', () => {
  const p = katalog()
  assert.equal(env.cofnijEnvE2e(p).detal, '')
  writeFileSync(join(p, env.PLIK_DEV), 'EXPO_PUBLIC_A=operator\n')
  writeFileSync(join(p, env.PLIK_KOPII), 'EXPO_PUBLIC_A=kopia\n')
  assert.match(env.cofnijEnvE2e(p).detal, /zostaje/)
  assert.equal(readFileSync(join(p, env.PLIK_DEV), 'utf8'), 'EXPO_PUBLIC_A=operator\n')
  assert.equal(existsSync(join(p, env.PLIK_KOPII)), true)
})

// --- urządzenie i dev-client ---

const BUNDLE = 'com.example.app'
const APLIKACJA = { bundleId: BUNDLE, appId: 'com.example.android', scheme: 'przyklad' }

/**
 * @param {string} baza @param {string} nazwa @param {{ stan?: string, konto?: boolean, aplikacja?: boolean }} o
 * @returns {{ udid: string, name: string, state: string, dataPath: string, isAvailable: boolean, deviceTypeIdentifier: string, konto: boolean }}
 */
function symulator(baza, nazwa, { stan = 'Shutdown', konto = false, aplikacja = true } = {}) {
  const udid = `UDID-${nazwa}`
  const dataPath = join(baza, udid)
  mkdirSync(join(dataPath, 'Library/Accounts'), { recursive: true })
  writeFileSync(join(dataPath, 'Library/Accounts/Accounts3.sqlite'), '')
  if (aplikacja) {
    mkdirSync(join(dataPath, 'Containers/Bundle/Application/X'), { recursive: true })
    writeFileSync(join(dataPath, 'Containers/Bundle/Application/X/.com.apple.mobile_container_manager.metadata.plist'), `bplist${BUNDLE}`)
  }
  return { udid, name: nazwa, state: stan, dataPath, isAvailable: true, deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17', konto }
}

/**
 * Atrapa komend systemowych: simctl, sqlite3, codesign, adb.
 * @param {ReturnType<typeof symulator>[]} lista @param {{ aplikacja?: string, podpis?: string, adb?: string, pmPath?: string, mtimeAdb?: string }} o
 */
function atrapa(lista, { aplikacja = '', podpis = 'Executable=/x', adb = 'List of devices attached\n', pmPath = '', mtimeAdb = '' } = {}) {
  /** @type {string[]} */
  const wywolania = []
  const wynik = (/** @type {string} */ stdout, status = 0, stderr = '') => ({ status, stdout, stderr })
  /** @param {string} komenda @param {string[]} a */
  const wykonaj = (komenda, a) => {
    wywolania.push(`${komenda} ${a.join(' ')}`)
    if (komenda === 'sqlite3') return wynik(lista.find((s) => a[0].includes(s.udid))?.konto ? '1\n' : '0\n')
    if (komenda === 'codesign') return wynik('', 0, podpis)
    if (komenda === 'adb' && a[0] === 'devices') return wynik(adb)
    if (komenda === 'adb' && a.includes('pm')) return wynik(pmPath)
    if (komenda === 'adb' && a.includes('stat')) return wynik(mtimeAdb, mtimeAdb ? 0 : 1)
    if (a[1] === 'list') return wynik(JSON.stringify({ devices: { 'com.apple.CoreSimulator.SimRuntime.iOS-26-4': lista } }))
    if (a[1] === 'get_app_container') return wynik(aplikacja, aplikacja ? 0 : 1)
    return wynik('')
  }
  return { wykonaj, wywolania }
}

/** @returns {{ baza: string, projekt: string, app: string }} projekt i binarka nowsza od konfiguracji */
function uklad() {
  const baza = katalog()
  const projekt = katalog()
  writeFileSync(join(projekt, 'app.json'), JSON.stringify({ expo: { scheme: 'przyklad', ios: { bundleIdentifier: BUNDLE }, android: { package: 'com.example.android' } } }))
  utimesSync(join(projekt, 'app.json'), 1000, 1000)
  const app = join(baza, 'Przyklad.app')
  mkdirSync(app)
  return { baza, projekt, app }
}

test('urządzenie: symulator z kontem Apple odpada, włączony bez konta wygrywa; wyłączonego nie bootuje bez potrzeby', () => {
  const { baza, projekt, app } = uklad()
  const lista = [symulator(baza, 'iPhone 17 Pro', { stan: 'Booted', konto: true }), symulator(baza, 'iPhone 17e'), symulator(baza, 'iPhone 17', { stan: 'Booted' })]
  const { wykonaj, wywolania } = atrapa(lista, { aplikacja: app })
  const w = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, wykonaj)
  assert.equal(w.ok, true)
  assert.equal(w.urzadzenie.nazwa, 'iPhone 17')
  assert.deepEqual(wywolania.filter((c) => c.includes(' boot ')), [])
})

test('urządzenie: wyłączony iPhone z dev-clientem jest bootowany; bez dev-clienta odpada', () => {
  const { baza, projekt, app } = uklad()
  const lista = [symulator(baza, 'iPhone Air', { aplikacja: false }), symulator(baza, 'iPhone 17')]
  const { wykonaj, wywolania } = atrapa(lista, { aplikacja: app })
  const w = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, wykonaj)
  assert.equal(w.urzadzenie.nazwa, 'iPhone 17')
  assert.ok(wywolania.includes('xcrun simctl boot UDID-iPhone 17'))
  assert.ok(wywolania.includes('xcrun simctl bootstatus UDID-iPhone 17 -b'))
})

test('urządzenie: E2E_URZADZENIE zawęża wybór; wskazany z kontem Apple = STOP z przyczyną', () => {
  const { baza, projekt, app } = uklad()
  const lista = [symulator(baza, 'iPhone 17', { stan: 'Booted' }), symulator(baza, 'iPhone 17e')]
  const { wykonaj } = atrapa(lista, { aplikacja: app })
  assert.equal(urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, { E2E_URZADZENIE: 'iPhone 17e' }, wykonaj).urzadzenie.nazwa, 'iPhone 17e')
  const zKontem = atrapa([symulator(baza, 'iPhone 17 Pro', { konto: true })], { aplikacja: app })
  const w = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, { E2E_URZADZENIE: 'iPhone 17 Pro', E2E_PLATFORMA: 'ios' }, zKontem.wykonaj)
  assert.equal(w.ok, false)
  assert.match(w.detal, /iPhone 17 Pro: zalogowane konto Apple/)
})

test('urządzenie: nieznana baza kont nie blokuje, ale idzie jako uwaga', () => {
  const { baza, projekt, app } = uklad()
  const s = symulator(baza, 'iPhone 17', { stan: 'Booted' })
  const a = atrapa([s], { aplikacja: app })
  const wykonaj = (/** @type {string} */ k, /** @type {string[]} */ b) => (k === 'sqlite3' ? { status: 1, stdout: '', stderr: 'no such table' } : a.wykonaj(k, b))
  const w = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, wykonaj)
  assert.equal(w.ok, true)
  assert.deepEqual(w.uwagi, ['iPhone 17: nie sprawdzono konta Apple'])
})

test('dev-client: starszy od lockfile\'a bez historii git = STOP z komendą przebudowy i LANG (fail-closed); package.json się nie liczy', () => {
  const { baza, projekt, app } = uklad()
  utimesSync(app, 2000, 2000)
  writeFileSync(join(projekt, 'package.json'), '{}')
  const { wykonaj } = atrapa([symulator(baza, 'iPhone 17', { stan: 'Booted' })], { aplikacja: app })
  assert.equal(urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, wykonaj).ok, true, 'nowszy package.json nie unieważnia binarki')
  writeFileSync(join(projekt, 'package-lock.json'), '{}')
  const w = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, wykonaj)
  assert.equal(w.ok, false)
  assert.equal(w.przebudowa, true)
  assert.match(w.detal, /starszy niż package-lock\.json: nie odczytano historii git/)
  assert.match(w.naprawa, /LANG=en_US\.UTF-8 npx expo prebuild --clean --platform ios && LANG=en_US\.UTF-8 npx expo run:ios --no-bundler/)
})

test('dev-client: nowszy ios/Podfile.lock = STOP bez pytania o diff; nowszy lockfile po samym checkoucie = uwaga bez przebudowy', () => {
  const { baza, projekt, app } = uklad()
  utimesSync(app, 2000, 2000)
  const { wykonaj } = atrapa([symulator(baza, 'iPhone 17', { stan: 'Booted' })], { aplikacja: app })
  mkdirSync(join(projekt, 'ios'))
  writeFileSync(join(projekt, 'ios/Podfile.lock'), '')
  const w = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, wykonaj)
  assert.deepEqual([w.ok, w.przebudowa], [false, true])
  assert.match(w.detal, /starszy niż ios\/Podfile\.lock: warstwa natywna zmieniona po buildzie/)
  rmSync(join(projekt, 'ios'), { recursive: true })
  writeFileSync(join(projekt, 'package-lock.json'), '{}')
  repoGit(projekt)
  const ok = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, wykonaj)
  assert.equal(ok.ok, false, 'commit jest nowszy niż binarka z 1970, więc to nadal zmiana do oceny: nowy lockfile bez pakietów')
  utimesSync(app, new Date(), new Date(Date.now() + 60_000))
  utimesSync(join(projekt, 'package-lock.json'), new Date(), new Date(Date.now() + 120_000))
  const poCheckoucie = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, wykonaj)
  assert.equal(poCheckoucie.ok, true, JSON.stringify(poCheckoucie))
  assert.match(poCheckoucie.uwagi[0], /przebudowa niepotrzebna: treść konfiguracji bez zmian/)
})

// --- bramka natywna ---

/** @param {string} p @param {string[]} a */
const git = (p, a) => spawnSync('git', ['-C', p, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' })

/** @param {string} p repo z commitem startowym */
function repoGit(p) {
  git(p, ['init', '-q'])
  git(p, ['add', '-A'])
  git(p, ['commit', '-qm', 'start'])
}

/** @param {string} p @param {string} nazwa @param {Record<string, string>} pliki pakiet w node_modules */
function pakiet(p, nazwa, pliki) {
  for (const [s, t] of Object.entries({ 'package.json': '{}', ...pliki })) {
    mkdirSync(dirname(join(p, 'node_modules', nazwa, s)), { recursive: true })
    writeFileSync(join(p, 'node_modules', nazwa, s), t)
  }
}

/** @returns {string} projekt w repo git z package.json i app.json */
function projektNatywny() {
  const p = katalog()
  writeFileSync(join(p, 'package.json'), JSON.stringify({ dependencies: { 'stary-js': '1.0.0' } }))
  writeFileSync(join(p, 'app.json'), JSON.stringify({ expo: { name: 'a', plugins: ['x'] } }))
  writeFileSync(join(p, '.gitignore'), 'node_modules\n')
  git(p, ['init', '-q'])
  git(p, ['add', '-A'])
  // Commit startowy sprzed builda: `--since` patrzy na datę commitera.
  spawnSync('git', ['-C', p, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'start'], { env: { ...process.env, GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z', GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z' } })
  return p
}

/** @param {string} p @param {string} wiadomosc */
const commit = (p, wiadomosc) => { git(p, ['add', '-A']); git(p, ['commit', '-qm', wiadomosc]) }
/** Binarka zbudowana przed następnymi commitami: --since ma sekundową dokładność, więc punkt cofnięty o minutę od HEAD. */
const POTEM = () => Math.floor(Date.now() / 1000) - 60

test('dowód natywności z dysku: każdy znacznik; pakiet JS = null; brak katalogu = natywny; układ pnpm', () => {
  const p = katalog()
  for (const [nazwa, plik] of /** @type {[string, string][]} */ ([['a', 'expo-module.config.json'], ['b', 'ios/x.m'], ['c', 'android/build.gradle'], ['d', 'app.plugin.js'], ['e', 'apple/x.podspec'], ['f', 'build.gradle']])) pakiet(p, nazwa, { [plik]: '' })
  pakiet(p, 'g', { 'package.json': '{"expo":{}}' })
  pakiet(p, '@s/js', { 'index.js': '', 'lib/a.js': '' })
  assert.equal(urzadzenie.przestarzaly(p, Date.now() / 1000 + 100, 'ios'), null)
  const dowod = natywne.dowodNatywnosci
  assert.deepEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n) => dowod(p, n)), ['expo-module.config.json', 'ios', 'android', 'app.plugin.js', 'podspec albo build.gradle', 'podspec albo build.gradle', 'pole expo w package.json'])
  assert.equal(dowod(p, '@s/js'), null)
  assert.match(dowod(p, 'brak'), /brak node_modules\/brak, potraktowany jak natywny/)
  mkdirSync(join(p, 'node_modules/.pnpm/@s+nat@1.0.0/node_modules/@s/nat/ios'), { recursive: true })
  assert.equal(dowod(p, '@s/nat'), 'ios')
})

test('lockfile: pakiety z diffu każdego formatu; nieznany format daje pustą listę', () => {
  assert.deepEqual(natywne.pakietyZLockfile('package-lock.json', ' "node_modules/@s/a": {\n+  "version": "2.0.0",\n-  "version": "1.0.0",\n+"node_modules/b": {\n+  "version": "1.0.0",\n "node_modules/c/node_modules/d": {\n+ "version": "3.0.0"\n'), ['@s/a', 'b', 'd'])
  assert.deepEqual(natywne.pakietyZLockfile('package-lock.json', '@@ -1 +1 @@\n+  "version": "2.0.0",\n'), ['?'], 'wersja bez nazwy w kontekście')
  assert.deepEqual(natywne.pakietyZLockfile('pnpm-lock.yaml', "+  '@s/a@2.0.0':\n+  b@1.0.0(react@19.0.0):\n-  c@1.0.0:\n+    dependencies:\n+      d: 1.0.0\n"), ['@s/a', 'b'])
  assert.deepEqual(natywne.pakietyZLockfile('yarn.lock', '+"@s/a@^2.0.0":\n+b@^1.0.0:\n+  version "1.0.0"\n'), ['@s/a', 'b'])
  assert.deepEqual(natywne.pakietyZLockfile('bun.lock', '+    "@s/a": ["@s/a@2.0.0", "", {}, "sha"],\n+    "b": ["b@1.0.0"],\n'), ['@s/a', 'b'])
  assert.deepEqual(natywne.pakietyZLockfile('bun.lockb', 'Binary files differ'), [])
})

test('zależności: dodane i podbite z obu sekcji; bez zmian i usunięte się nie liczą', () => {
  assert.deepEqual(natywne.zmienioneZaleznosci({ dependencies: { a: '1', b: '1', c: '1' }, devDependencies: { d: '1' } }, { dependencies: { a: '2', b: '1', n: '1' }, devDependencies: { d: '1', t: '1' } }).sort(), ['a', 'n', 't'])
})

test('bramka: paczka natywna w commicie po buildzie = przebudowa; paczka JS = bez przebudowy z nazwą', () => {
  const p = projektNatywny()
  pakiet(p, 'nowy-natywny', { 'expo-module.config.json': '{}' })
  pakiet(p, 'nowy-js', { 'index.js': '' })
  const mtime = POTEM()
  writeFileSync(join(p, 'package.json'), JSON.stringify({ dependencies: { 'stary-js': '1.0.0', 'nowy-js': '1.0.0' } }))
  commit(p, 'js')
  const js = natywne.zmianyNatywne(p, mtime)
  assert.deepEqual([js.wymagaRebuildu, js.detal], [false, 'zmiany bez kodu natywnego: nowy-js'])
  writeFileSync(join(p, 'package.json'), JSON.stringify({ dependencies: { 'stary-js': '1.0.0', 'nowy-js': '1.0.0', 'nowy-natywny': '1.0.0' } }))
  commit(p, 'natywny')
  const nat = natywne.zmianyNatywne(p, mtime)
  assert.equal(nat.wymagaRebuildu, true)
  assert.deepEqual(nat.nowe, ['nowy-natywny (expo-module.config.json)'])
})

test('bramka: paczka dopisana bez instalacji = natywna; zmiana niezacommitowana też się liczy', () => {
  const p = projektNatywny()
  writeFileSync(join(p, 'package.json'), JSON.stringify({ dependencies: { 'stary-js': '2.0.0' } }))
  const w = natywne.zmianyNatywne(p, Math.floor(Date.now() / 1000) + 100)
  assert.equal(w.wymagaRebuildu, true)
  assert.match(w.detal, /stary-js \(brak node_modules\/stary-js, potraktowany jak natywny\)/)
})

test('bramka: pola natywne app.json i app.config.* wymagają przebudowy, inne pola app.json nie', () => {
  const p = projektNatywny()
  const mtime = POTEM()
  writeFileSync(join(p, 'app.json'), JSON.stringify({ expo: { name: 'b', plugins: ['x'] } }))
  commit(p, 'nazwa')
  assert.equal(natywne.zmianyNatywne(p, mtime).wymagaRebuildu, false)
  writeFileSync(join(p, 'app.json'), JSON.stringify({ expo: { name: 'b', plugins: ['x', 'y'], ios: { bundleIdentifier: 'i' } } }))
  commit(p, 'plugin')
  assert.deepEqual(natywne.zmianyNatywne(p, mtime).nowe, ['app.json:plugins', 'app.json:ios'])
  writeFileSync(join(p, 'app.config.ts'), 'export default {}')
  commit(p, 'config')
  assert.ok(natywne.zmianyNatywne(p, mtime).nowe.includes('app.config.ts: zmiana konfiguracji'))
})

test('bramka: nieczytelny lockfile = przebudowa; repo bez git = przebudowa; sam checkout = bez przebudowy', () => {
  const p = projektNatywny()
  const mtime = POTEM()
  writeFileSync(join(p, 'bun.lockb'), 'binarny')
  commit(p, 'lock')
  assert.deepEqual(natywne.zmianyNatywne(p, mtime).nowe, ['bun.lockb: nie rozstrzygnięto'])
  assert.equal(natywne.zmianyNatywne(katalog(), mtime).wymagaRebuildu, true)
  assert.deepEqual(natywne.zmianyNatywne(p, Math.floor(Date.now() / 1000) + 100), { wymagaRebuildu: false, nowe: [], detal: 'treść konfiguracji bez zmian od builda' })
})

test('dev-client: nowszy plik natywny drugiej platformy nie unieważnia binarki', () => {
  const { projekt } = uklad()
  mkdirSync(join(projekt, 'android'))
  writeFileSync(join(projekt, 'android/build.gradle'), '')
  assert.equal(urzadzenie.przestarzaly(projekt, 2000, 'ios'), null)
  assert.equal(urzadzenie.przestarzaly(projekt, 2000, 'android'), 'android/build.gradle')
})

test('dev-client iOS bez podpisu = STOP niezależnie od uprawnień w app.json', () => {
  const { baza, projekt, app } = uklad()
  const { wykonaj } = atrapa([symulator(baza, 'iPhone 17', { stan: 'Booted' })], { aplikacja: app, podpis: `${app}: code object is not signed at all` })
  const w = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, wykonaj)
  assert.equal(w.ok, false)
  assert.match(w.detal, /bez podpisu/)
})

test('Android: zapas przy braku iOS; E2E_PLATFORMA wymusza; brak odczytu mtime to uwaga, stary dev-client STOP', () => {
  const { projekt } = uklad()
  const adb = 'List of devices attached\nemulator-5554\tdevice\nemulator-5556\toffline\n'
  const bez = atrapa([], { adb, pmPath: 'package:/data/app/x/base.apk\n' })
  const w = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, bez.wykonaj)
  assert.deepEqual([w.urzadzenie.platforma, w.urzadzenie.id], ['android', 'emulator-5554'])
  assert.match(w.uwagi[0], /nie sprawdzono świeżości/)
  const stary = atrapa([], { adb, pmPath: 'package:/data/app/x/base.apk\n', mtimeAdb: '500\n' })
  const w2 = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, { E2E_PLATFORMA: 'android' }, stary.wykonaj)
  assert.equal(w2.ok, false)
  assert.match(w2.detal, /starszy niż app\.json/)
  assert.equal(w2.przebudowa, true)
  assert.match(w2.naprawa, /npx expo prebuild --clean --platform android && npx expo run:android --no-bundler/)
})

test('brak urządzenia = STOP z przyczynami i naprawą obu platform; zła E2E_PLATFORMA = STOP', () => {
  const { baza, projekt } = uklad()
  const { wykonaj } = atrapa([symulator(baza, 'iPhone 17', { aplikacja: false })])
  const w = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, wykonaj)
  assert.equal(w.ok, false)
  assert.match(w.detal, /iPhone 17: brak dev-clienta; Android: brak działającego emulatora/)
  assert.match(w.naprawa, /emulator -avd/)
  assert.equal(urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, { E2E_PLATFORMA: 'windows' }, wykonaj).ok, false)
})

/** @param {{ ok: boolean, detal?: string, naprawa?: string, przebudowa?: boolean }} w @param {RegExp} detal */
function bezPrzebudowy(w, detal) {
  assert.equal(w.ok, false)
  assert.match(String(w.detal), detal)
  assert.equal(w.przebudowa, undefined, w.detal)
  assert.doesNotMatch(String(w.naprawa), /prebuild|run:ios|run:android/, w.detal)
}

test('brak działającego urządzenia = włącz je, bez przebudowy i bez prebuild w naprawie', () => {
  const { baza, projekt } = uklad()
  const przygotuj = (/** @type {Record<string, string>} */ srodowisko, /** @type {ReturnType<typeof atrapa>} */ a, opcje = {}) => urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, srodowisko, a.wykonaj, opcje)
  const wylaczonyEmulator = przygotuj({ E2E_PLATFORMA: 'android' }, atrapa([]))
  bezPrzebudowy(wylaczonyEmulator, /Android: brak działającego emulatora/)
  assert.match(wylaczonyEmulator.naprawa, /emulator -avd/)
  assert.doesNotMatch(wylaczonyEmulator.naprawa, /iOS/)
  bezPrzebudowy(przygotuj({ E2E_PLATFORMA: 'android' }, atrapa([], { adb: 'List of devices attached\nemulator-5556\toffline\n' })), /Android: brak działającego emulatora/)
  const nicNieMa = przygotuj({}, atrapa([]))
  bezPrzebudowy(nicNieMa, /Android: brak działającego emulatora/)
  assert.match(nicNieMa.naprawa, /simctl boot/)
  assert.match(nicNieMa.naprawa, /emulator -avd/)
  const samoKonto = przygotuj({ E2E_PLATFORMA: 'ios' }, atrapa([symulator(baza, 'iPhone 17 Pro', { konto: true })]))
  bezPrzebudowy(samoKonto, /iPhone 17 Pro: zalogowane konto Apple/)
  assert.match(samoKonto.naprawa, /bez konta Apple/)
  assert.doesNotMatch(samoKonto.naprawa, /emulator/)
  bezPrzebudowy(przygotuj({ E2E_PLATFORMA: 'ios' }, atrapa([symulator(baza, 'iPhone 17', { aplikacja: false })]), { tylkoWlaczone: true }), /brak iPhone w simctl/)
})

test('brak dev-clienta = przebudowa tylko na wybranej platformie, także na działającym emulatorze', () => {
  const { baza, projekt } = uklad()
  const adb = 'List of devices attached\nemulator-5554\tdevice\n'
  const emulatorBezKlienta = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, { E2E_PLATFORMA: 'android' }, atrapa([], { adb }).wykonaj)
  assert.deepEqual([emulatorBezKlienta.ok, emulatorBezKlienta.przebudowa], [false, true])
  assert.match(emulatorBezKlienta.detal, /Android: działający emulator bez dev-clienta/)
  assert.ok(emulatorBezKlienta.naprawa.includes(urzadzenie.REBUILD.android), emulatorBezKlienta.naprawa)
  assert.ok(!emulatorBezKlienta.naprawa.includes(urzadzenie.REBUILD.ios), emulatorBezKlienta.naprawa)
  assert.ok(emulatorBezKlienta.naprawa.includes(urzadzenie.OSTRZEZENIE_CLEAN), emulatorBezKlienta.naprawa)
  const symulatorBezKlienta = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, { E2E_PLATFORMA: 'ios' }, atrapa([symulator(baza, 'iPhone 17', { aplikacja: false })]).wykonaj)
  assert.deepEqual([symulatorBezKlienta.ok, symulatorBezKlienta.przebudowa], [false, true])
  assert.ok(symulatorBezKlienta.naprawa.includes(urzadzenie.REBUILD.ios), symulatorBezKlienta.naprawa)
  assert.ok(!symulatorBezKlienta.naprawa.includes(urzadzenie.REBUILD.android), symulatorBezKlienta.naprawa)
  const obie = urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, {}, atrapa([symulator(baza, 'iPhone 17e', { aplikacja: false })]).wykonaj)
  assert.deepEqual([obie.ok, obie.przebudowa], [false, true])
  assert.ok(obie.naprawa.includes(urzadzenie.REBUILD.ios) && obie.naprawa.includes(urzadzenie.REBUILD.android), obie.naprawa)
  // Pilot Nawykometr: Sign in with Apple bez certyfikatu — `expo run:ios` pada także na symulatorze, naprawa iOS podaje podpis ad-hoc.
  assert.ok(symulatorBezKlienta.naprawa.includes(urzadzenie.UWAGA_PODPISU_IOS), symulatorBezKlienta.naprawa)
  assert.ok(!emulatorBezKlienta.naprawa.includes(urzadzenie.REBUILD_IOS_ADHOC), emulatorBezKlienta.naprawa)
  assert.match(urzadzenie.REBUILD_IOS_ADHOC, /xcodebuild .*-sdk iphonesimulator .*CODE_SIGN_IDENTITY=- build && xcrun simctl install /)
  assert.doesNotMatch(urzadzenie.REBUILD_IOS_ADHOC, /CODE_SIGNING_ALLOWED=NO/)
})

test('wyłączony emulator: restart bez STOP-u przebudowy, a świeżość bez prebuild w naprawie', async () => {
  const { restartFazy } = await modul('start.mjs')
  const { swiezosc } = await modul('expo-swiezosc.mjs')
  const { projekt } = uklad()
  const zadanie = 'docs/active/z'
  mkdirSync(join(projekt, zadanie), { recursive: true })
  writeFileSync(join(projekt, zadanie, 'z-zadania.md'), '## Faza 1 — A\n\n- [ ] Test: [E2E] `a` — /a → ok\n')
  writeFileSync(join(projekt, '.env.e2e'), 'E2E_URL=http://127.0.0.1:8081\nE2E_START=npx expo start\nE2E_PLATFORMA=android\n')
  writeFileSync(join(projekt, 'package.json'), JSON.stringify({ dependencies: { expo: '58.0.0' } }))
  const { wykonaj } = atrapa([])
  const przedStartem = (/** @type {string} */ p, /** @type {Record<string, string>} */ e) => urzadzenie.przygotujUrzadzenie(p, APLIKACJA, e, wykonaj)
  const restart = await restartFazy(projekt, zadanie, 1, { kroki: { przedStartem } })
  assert.deepEqual([restart.status, restart.krokStacku, restart.przebudowa], ['niepowodzenie', true, false])
  assert.match(restart.naprawa, /emulator -avd/)
  const w = swiezosc(projekt, { E2E_PLATFORMA: 'android' }, wykonaj)
  assert.deepEqual([w.ok, w.przebudowa], [false, false])
  assert.match(w.detal, /brak działającego emulatora/)
  assert.doesNotMatch(w.naprawa, /prebuild/)
})

test('aplikacja: identyfikatory z app.json; app.config przez Expo CLI projektu; repo bez konfiguracji = null', () => {
  const { projekt } = uklad()
  assert.deepEqual(urzadzenie.aplikacjaProjektu(projekt), APLIKACJA)
  const q = katalog()
  writeFileSync(join(q, 'app.config.ts'), 'export default {}')
  /** @type {string[][]} */
  const wolania = []
  const wykonaj = (/** @type {string} */ k, /** @type {string[]} */ a) => {
    wolania.push([k, ...a])
    return { status: 0, stdout: JSON.stringify({ scheme: ['a', 'b'], ios: { bundleIdentifier: 'i' }, android: { package: 'p' } }), stderr: '' }
  }
  assert.deepEqual(urzadzenie.aplikacjaProjektu(q, wykonaj), { bundleId: 'i', appId: 'p', scheme: 'a' })
  assert.deepEqual(wolania[0].slice(1), ['config', '--json'])
  assert.equal(urzadzenie.aplikacjaProjektu(katalog()), null)
})

// --- canary ---

test('canary: adres Metro per platforma; flow bez logowania nie ma launchApp przed openLink', () => {
  assert.equal(canary.adresMetro('ios', 8081), 'http%3A%2F%2F127.0.0.1%3A8081')
  assert.equal(canary.adresMetro('android', 8081), 'http%3A%2F%2F10.0.2.2%3A8081')
  const flow = canary.flowWejscia(BUNDLE, 'przyklad', 'ADRES')
  assert.match(flow, new RegExp(`^appId: ${BUNDLE}\\n---\\n- stopApp\\n- openLink: "przyklad://expo-development-client/\\?url=ADRES"`))
  assert.doesNotMatch(flow, /launchApp/)
  assert.match(flow, /Cannot find native module/)
  assert.match(canary.flowWejscia(BUNDLE, null, 'ADRES'), /- launchApp/)
})

test('canary: własny flow dostaje zmienne i urządzenie; hasło nie wychodzi w naprawie ani wyniku', async () => {
  const p = katalog()
  mkdirSync(join(p, '.maestro'))
  writeFileSync(join(p, canary.PLIK_CANARY), 'appId: x\n')
  /** @type {string[]} */
  let argumenty = []
  /** @type {string[]} */
  let sekrety = []
  /** @type {Record<string, string>} */
  let srodowisko = {}
  const maestro = async (/** @type {string[]} */ a, /** @type {string} */ _cwd, /** @type {{ sekrety: string[], srodowisko: Record<string, string> }} */ z) => {
    argumenty = a
    sekrety = z.sekrety
    srodowisko = z.srodowisko
    return { kod: 0, ogon: '' }
  }
  const cel = { port: 8081, urzadzenie: { platforma: 'ios', id: 'UDID', nazwa: 'iPhone 17', sciezkaAplikacji: 'x' }, aplikacja: APLIKACJA }
  const w = await canary.przejdzCanary(p, { E2E_TEST_EMAIL: 'e2e@a.test', E2E_TEST_PASSWORD: 'tajne' }, cel, { maestro })
  assert.equal(w.ok, true)
  assert.match(w.detal, /_canary\.yaml przeszedł/)
  assert.deepEqual(argumenty.slice(0, 3), ['--device', 'UDID', 'test'])
  assert.equal(argumenty.at(-1), canary.PLIK_CANARY)
  for (const z of [`APP_ID=${BUNDLE}`, 'APP_SCHEME=przyklad', 'METRO_URL=http%3A%2F%2F127.0.0.1%3A8081']) assert.ok(argumenty.includes(z), z)
  assert.ok(!argumenty.some((a) => /e2e@a\.test|tajne|E2E_|MAESTRO_/.test(a)), 'konto poza argumentami procesu')
  assert.deepEqual(srodowisko, { MAESTRO_E2E_EMAIL: 'e2e@a.test', MAESTRO_E2E_PASSWORD: 'tajne' })
  assert.deepEqual(sekrety, ['tajne'])
  assert.equal(canary.zamaskuj('Input text tajne', sekrety), 'Input text ***')
})

test('canary: bez własnego flow idzie plik tymczasowy i nazwany słaby dowód; porażka z modułem natywnym wskazuje przebudowę', async () => {
  const p = katalog()
  const cel = { port: 8081, urzadzenie: { platforma: 'android', id: 'emulator-5554', nazwa: 'emulator-5554', sciezkaAplikacji: 'x' }, aplikacja: APLIKACJA }
  /** @type {string} */
  let plik = ''
  const ok = await canary.przejdzCanary(p, {}, cel, {
    maestro: async (/** @type {string[]} */ a) => {
      plik = readFileSync(String(a.at(-1)), 'utf8')
      return { kod: 0, ogon: '' }
    },
  })
  assert.equal(ok.ok, true)
  assert.match(ok.detal, /słaby dowód/)
  assert.match(plik, /appId: com\.example\.android/)
  assert.match(plik, /10\.0\.2\.2/)
  const zle = await canary.przejdzCanary(p, {}, cel, { maestro: async () => ({ kod: 1, ogon: 'Cannot find native module X' }) })
  assert.equal(zle.ok, false)
  assert.match(zle.naprawa, /przebuduj/)
})

test('canary: po porażce katalog roboczy zostaje ze zrzutem, bez zapisu komend z wartościami zmiennych', async () => {
  const p = katalog()
  /** @type {string} */
  let robocze = ''
  const cel = { port: 8081, urzadzenie: { platforma: 'ios', id: 'U1', nazwa: 'iPhone 17', sciezkaAplikacji: null }, aplikacja: APLIKACJA }
  const maestro = async (/** @type {string[]} */ a) => {
    robocze = a[a.indexOf('--test-output-dir') + 1]
    assert.ok(a[a.indexOf('--debug-output') + 1].startsWith(robocze), 'zapis debug w katalogu roboczym, nie w ~/.maestro/tests')
    mkdirSync(join(robocze, 'przebieg'), { recursive: true })
    writeFileSync(join(robocze, 'przebieg/commands-(canary.yaml).json'), 'tajne')
    writeFileSync(join(robocze, 'przebieg/zrzut.png'), 'png')
    return { kod: 1, ogon: 'Assertion is false' }
  }
  const w = await canary.przejdzCanary(p, { E2E_TEST_PASSWORD: 'tajne' }, cel, { maestro })
  assert.equal(w.ok, false)
  assert.equal(existsSync(join(robocze, 'przebieg/commands-(canary.yaml).json')), false)
  assert.equal(existsSync(join(robocze, 'przebieg/zrzut.png')), true)
})

test('canary: uruchomMaestro maskuje hasło w ogonie i na stderr, oddaje kod; brak programu daje wynik zamiast wyjątku', async () => {
  const bin = katalog()
  writeFileSync(join(bin, 'maestro'), '#!/bin/sh\necho "Input text tajne"\nexit 3\n', { mode: 0o755 })
  const sciezka = process.env.PATH
  const pisz = process.stderr.write
  /** @type {string[]} */
  const stderr = []
  process.stderr.write = /** @type {typeof process.stderr.write} */ ((/** @type {string} */ t) => { stderr.push(t); return true })
  try {
    process.env.PATH = `${bin}:${sciezka}`
    const w = await canary.uruchomMaestro(['test'], bin, { sekrety: ['tajne'] })
    assert.deepEqual(w, { kod: 3, ogon: 'Input text ***' })
    assert.deepEqual(stderr, ['Input text ***\n'])
    process.env.PATH = katalog()
    const brak = await canary.uruchomMaestro(['test'], bin, { sekrety: [] })
    assert.match(String(brak.kod), /ENOENT/)
  } finally {
    process.stderr.write = pisz
    process.env.PATH = sciezka
  }
})

// Pilot run 4 (W36): canary zatrzymany limitem skryptu dał STOP „kod SIGKILL” ze stosem Maestro, a sesja uznała to za zabicie przez system.
test('canary: przekroczony limit skryptu nazwany w wyniku i w STOP-ie, z pomiarem czasu w naprawie; zwykły SIGKILL bez tej treści', async () => {
  const bin = katalog()
  writeFileSync(join(bin, 'maestro'), '#!/bin/sh\necho "at maestro.utils.FileUtils.zipDir"\nexec sleep 30\n', { mode: 0o755 })
  const sciezka = process.env.PATH
  const pisz = process.stderr.write
  process.stderr.write = /** @type {typeof process.stderr.write} */ (() => true)
  try {
    process.env.PATH = `${bin}:${sciezka}`
    const w = await canary.uruchomMaestro(['test'], bin, { sekrety: [] }, 3000)
    assert.deepEqual(w, { kod: 'SIGKILL', ogon: 'at maestro.utils.FileUtils.zipDir', przekroczonyLimitMs: 3000 })
  } finally {
    process.stderr.write = pisz
    process.env.PATH = sciezka
  }
  const p = katalog()
  const cel = { port: 8081, urzadzenie: { platforma: 'ios', id: 'U1', nazwa: 'iPhone 17', sciezkaAplikacji: null }, aplikacja: APLIKACJA }
  const limit = await canary.przejdzCanary(p, {}, cel, { maestro: async () => ({ kod: 'SIGKILL', ogon: 'zipDir', przekroczonyLimitMs: 240_000 }) })
  assert.equal(limit.ok, false)
  assert.match(limit.detal, /^canary na iPhone 17: przekroczony limit 240 s — skrypt zatrzymał Maestro \(SIGKILL\)/)
  assert.match(limit.naprawa, /^Zmierz czas ręcznie: time maestro --device U1 test <flow>\. Krótki przebieg = obciążony komputer/)
  const obcy = await canary.przejdzCanary(p, {}, cel, { maestro: async () => ({ kod: 'SIGKILL', ogon: 'zipDir' }) })
  assert.equal(obcy.detal, 'canary na iPhone 17: kod SIGKILL\nzipDir')
  assert.equal(obcy.naprawa, 'Sprawdź ręcznie: maestro --device U1 test <flow>.')
})

test('reload: wysyła metodę reload przez /message i kończy się ok; zamknięty port = wynik z błędem', async () => {
  /** @type {string} */
  let odebrane = ''
  /** @type {import('node:stream').Duplex[]} */
  const polaczenia = []
  const serwer = createServer()
  serwer.on('upgrade', (zadanie, gniazdo) => {
    polaczenia.push(gniazdo)
    const klucz = createHash('sha1').update(`${zadanie.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
    assert.equal(zadanie.url, '/message')
    gniazdo.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${klucz}\r\n\r\n`)
    gniazdo.on('data', (/** @type {Buffer} */ ramka) => {
      if (odebrane) return
      const dlugosc = ramka[1] & 0x7f
      const maska = ramka.subarray(2, 6)
      odebrane = Buffer.from(ramka.subarray(6, 6 + dlugosc).map((b, i) => b ^ maska[i % 4])).toString()
    })
    gniazdo.on('error', () => {})
  })
  await new Promise((r) => { serwer.listen(0, '127.0.0.1', () => r(undefined)) })
  const adres = serwer.address()
  const port = adres && typeof adres === 'object' ? adres.port : 0
  try {
    assert.deepEqual(await canary.wyslijReload(port), { ok: true, detal: '' })
    assert.deepEqual(JSON.parse(odebrane), { version: 2, method: 'reload' })
  } finally {
    // Gniazdo po upgrade nie należy już do serwera HTTP: zostawione trzyma proces testu przy życiu.
    for (const g of polaczenia) g.destroy()
    serwer.close()
  }
  assert.equal((await canary.wyslijReload(port)).ok, false)
})

// --- kontrakt adaptera ---

test('adapter: polityka zastap, port 8081 bez portu deweloperskiego, CI usunięte z każdej komendy startu', () => {
  assert.equal(adapter.POLITYKA_OBCEGO, 'zastap')
  assert.equal(adapter.DOMYSLNY_PORT, 8081)
  assert.equal(adapter.PORT_DEV, null)
  assert.equal(adapter.komendaStartu('npm', 8081), 'env -u CI npx expo start --port 8081')
  assert.equal(adapter.komendaStartu('pnpm', 8082), 'env -u CI pnpm exec expo start --port 8082')
  assert.equal(adapter.komendaStartu('bun', 8081), 'env -u CI bunx expo start --port 8081')
  assert.equal(adapter.komendaStartu('yarn', 8081), 'env -u CI yarn expo start --port 8081')
})

test('adapter: sygnatury blokera łapią komunikaty modułu natywnego i entitlements, zwykły błąd nie', () => {
  const pasuje = (/** @type {string} */ tekst) => adapter.SYGNATURY_BLOKERA.filter((/** @type {{ wzorzec: string, flagi: string }} */ s) => new RegExp(s.wzorzec, s.flagi).test(tekst)).map((/** @type {{ klasa: string }} */ s) => s.klasa)
  assert.deepEqual(pasuje('Error: Cannot find native module ExpoClipboard'), ['brak-modulu-natywnego'])
  assert.deepEqual(pasuje("TurboModuleRegistry.getEnforcing(...): 'X' could not be found"), ['brak-modulu-natywnego'])
  assert.deepEqual(pasuje('SecureStore: a required entitlement is missing'), ['brak-entitlements'])
  assert.deepEqual(pasuje('errSecMissingEntitlement (-34018)'), ['brak-entitlements'])
  assert.deepEqual(pasuje('Unable to find element with text "Zaloguj"'), [])
  for (const s of adapter.SYGNATURY_BLOKERA) {
    assert.equal(s.polityka, 'stop-rebuild')
    assert.match(s.naprawa, /expo run:ios/)
  }
})

// Dosłownie, nie z modułu: test ma paść, gdy ostrzeżenie zniknie albo zmieni sens.
const OSTRZEZENIE = '`--clean` usuwa `ios/` i `android/`. Projekt, który trzyma te katalogi w repo, pomija `prebuild` i woła samo `expo run:*`.'

test('naprawa przebudowy: każdy STOP z komendą --clean niesie ostrzeżenie, z urządzenia i z sygnatur blokera; slot ma to samo zdanie', () => {
  const { baza, projekt, app } = uklad()
  const wlaczony = symulator(baza, 'iPhone 17', { stan: 'Booted' })
  const adb = 'List of devices attached\nemulator-5554\tdevice\n'
  const przygotuj = (/** @type {Record<string, string>} */ srodowisko, /** @type {ReturnType<typeof atrapa>} */ a) => urzadzenie.przygotujUrzadzenie(projekt, APLIKACJA, srodowisko, a.wykonaj)
  const przypadki = [
    { oczekiwany: /brak dev-clienta/, w: przygotuj({}, atrapa([wlaczony])) },
    { oczekiwany: /bez podpisu/, w: przygotuj({}, atrapa([wlaczony], { aplikacja: app, podpis: `${app}: code object is not signed at all` })) },
    { oczekiwany: /starszy niż app\.json/, w: przygotuj({ E2E_PLATFORMA: 'android' }, atrapa([], { adb, pmPath: 'package:/data/app/x/base.apk\n', mtimeAdb: '500\n' })) },
    { oczekiwany: /brak urządzenia do E2E/, w: przygotuj({}, atrapa([symulator(baza, 'iPhone 17e', { aplikacja: false })])) },
  ]
  utimesSync(app, 500, 500)
  przypadki.push({ oczekiwany: /starszy niż app\.json/, w: przygotuj({}, atrapa([wlaczony], { aplikacja: app })) })
  for (const { oczekiwany, w } of przypadki) {
    assert.equal(w.ok, false)
    assert.match(w.detal, oczekiwany)
    assert.equal(w.przebudowa, true, w.detal)
    assert.match(w.naprawa, /prebuild --clean/, w.detal)
    assert.ok(w.naprawa.includes(OSTRZEZENIE), `${w.detal}: ${w.naprawa}`)
  }
  assert.equal(adapter.SYGNATURY_BLOKERA.length, 2)
  for (const s of adapter.SYGNATURY_BLOKERA) assert.ok(s.naprawa.includes(OSTRZEZENIE), s.klasa)
  assert.ok(czytaj('.claude/stack/po-fazie.md').includes(OSTRZEZENIE))
})

test('naprawa przebudowy: ostrzeżenie dochodzi do wyniku e2e start i e2e restart', async () => {
  const { startE2e, restartFazy } = await modul('start.mjs')
  const { baza, projekt, app } = uklad()
  const zadanie = 'docs/active/z'
  mkdirSync(join(projekt, zadanie), { recursive: true })
  writeFileSync(join(projekt, zadanie, 'z-zadania.md'), '## Faza 1 — A\n\n- [ ] Test: [E2E] `a` — /a → ok\n')
  writeFileSync(join(projekt, '.env.e2e'), 'E2E_URL=http://127.0.0.1:8081\nE2E_START=npx expo start\n')
  writeFileSync(join(projekt, 'package.json'), JSON.stringify({ dependencies: { expo: '58.0.0' } }))
  utimesSync(app, 500, 500)
  const { wykonaj } = atrapa([symulator(baza, 'iPhone 17', { stan: 'Booted' })], { aplikacja: app })
  const przedStartem = (/** @type {string} */ p, /** @type {Record<string, string>} */ e) => urzadzenie.przygotujUrzadzenie(p, APLIKACJA, e, wykonaj)
  const poStarcie = async () => { throw new Error('poStarcie nie może ruszyć po STOP-ie') }
  const narzedzia = { czyIgnorowany: () => true, narzedzieJazdy: () => ({ ok: true, detal: '' }), zrzut: () => ({ ok: true, detal: '' }) }
  const start = await startE2e(projekt, zadanie, { uruchom: true, narzedzia, kroki: { przedStartem, poStarcie } })
  assert.equal(start.status, 'niepowodzenie', start.detal)
  assert.ok(start.naprawa.includes(OSTRZEZENIE), start.naprawa)
  const restart = await restartFazy(projekt, zadanie, 1, { kroki: { przedStartem } })
  assert.deepEqual([restart.status, restart.krokStacku, restart.przebudowa], ['niepowodzenie', true, true])
  assert.ok(restart.naprawa.includes(OSTRZEZENIE), restart.naprawa)
})

test('świeżość na koniec runu: stary dev-client = przebudowa z naprawą; aktualny = ok z urządzeniem; repo bez konfiguracji = ok', async () => {
  const { swiezosc } = await modul('expo-swiezosc.mjs')
  const { baza, projekt, app } = uklad()
  const { wykonaj } = atrapa([symulator(baza, 'iPhone 17', { stan: 'Booted' })], { aplikacja: app })
  assert.deepEqual(swiezosc(projekt, {}, wykonaj), { ok: true, przebudowa: false, detal: 'ios iPhone 17', naprawa: '' })
  utimesSync(app, 500, 500)
  const stary = swiezosc(projekt, {}, wykonaj)
  assert.deepEqual([stary.ok, stary.przebudowa], [false, true])
  assert.match(stary.detal, /starszy niż app\.json/)
  assert.ok(stary.naprawa.includes(OSTRZEZENIE))
  assert.deepEqual(swiezosc(katalog(), {}, wykonaj), { ok: true, przebudowa: false, detal: 'repo bez konfiguracji Expo', naprawa: '' })
})

test('adapter: wersja Javy ze starego i nowego formatu; niepoprawny tekst = null', () => {
  assert.equal(adapter.wersjaJavy('openjdk version "21.0.10" 2026-01-20'), 21)
  assert.equal(adapter.wersjaJavy('java version "1.8.0_391"'), 8)
  assert.equal(adapter.wersjaJavy('The operation couldn’t be completed. Unable to locate a Java Runtime.'), null)
})

test('adapter: repo bez konfiguracji Expo nie dostaje kroków stacku', async () => {
  const p = katalog()
  assert.deepEqual(adapter.przedStartem(p, {}), { ok: true, detal: '', naprawa: '' })
  assert.deepEqual(await adapter.poStarcie(p, {}, { port: 8081 }), { ok: true, detal: '', naprawa: '' })
  assert.equal(adapter.uwagaDoctora(p), null)
  assert.deepEqual(adapter.uwagiPlanowania(p, {}), [])
})

test('adapter: pozostawiony plik env = wiersz doctora i uwaga planowania; projekt Expo bez canary = uwaga; stop sprząta', () => {
  const p = katalog()
  writeFileSync(join(p, 'app.json'), '{}')
  assert.match(adapter.uwagiPlanowania(p, {})[0], /brak \.maestro\/_canary\.yaml/)
  writeFileSync(join(p, env.PLIK_DEV), `${env.ZNACZNIK}\nEXPO_PUBLIC_A=e2e\n`)
  const wiersz = spawnSync(process.execPath, [join(WARIANT, '.claude/scripts/doctor/uwaga-stacku.mjs'), p], { encoding: 'utf8' })
  assert.deepEqual(wiersz.stdout.trimEnd().split('\t').slice(0, 2), ['env E2E', 'UWAGA'])
  assert.match(adapter.uwagiPlanowania(p, {})[0], /przykrywa \.env\.local/)
  assert.match(adapter.poZatrzymaniu(p).detal, /usunięty/)
  assert.equal(existsSync(join(p, env.PLIK_DEV)), false)
  assert.equal(spawnSync(process.execPath, [join(WARIANT, '.claude/scripts/doctor/uwaga-stacku.mjs'), p], { encoding: 'utf8' }).stdout, '')
})

// --- profil, slot i szablony ---

test('profil: klucze EXPO_PUBLIC_*, katalog .maestro, jest, bez pliku e2e o wyższym priorytecie', () => {
  const p = JSON.parse(czytaj('.claude/stack/profil.json'))
  assert.equal(p.env.prefiksPubliczny, 'EXPO_PUBLIC_')
  assert.equal(p.env.adresSupabase, 'EXPO_PUBLIC_SUPABASE_URL')
  assert.deepEqual(p.env.plikiDev, ['.env', '.env.local'])
  assert.equal(p.env.plikE2eLokalny, null)
  assert.deepEqual([p.e2e.katalogSeedow, p.e2e.katalogRunnerow], ['.maestro', '.maestro'])
  assert.match(p.testy.powiazane, /^jest /)
  assert.ok(new RegExp(p.zrodla.frontend).test('src/app/index.tsx'))
  assert.ok(!new RegExp(p.zrodla.frontend).test('supabase/functions/x/index.ts'))
})

test('profil: sync-template zaciąga wariant z repo mobile (IU-3.4)', () => {
  const p = JSON.parse(czytaj('.claude/stack/profil.json'))
  assert.equal(p.szablon.repo, 'https://github.com/AIBiz-Automatyzacje/workspace-template-mobile.git')
})

test('slot e2e-srodowisko: te same sekcje co web; bez słów stacku web', () => {
  const slot = czytaj('.claude/stack/e2e-srodowisko.md')
  for (const s of ['Start aplikacji', 'Sonda zdrowia', 'Narzędzie jazdy']) assert.match(slot, new RegExp(`^## ${s}$`, 'm'))
  assert.doesNotMatch(slot, /agent-browser|\bVite\b|5174/)
  assert.match(slot, /sekcja „Aplikacja z osobnym serwerem API”/)
})

test('README: sekcja, do której odsyła rdzeń, Metro i canary zamiast przeglądarki', () => {
  const r = czytaj('.claude/templates/e2e-env/README.md')
  assert.match(r, /^## Aplikacja z osobnym serwerem API/m)
  assert.match(r, /\.env\.development\.local/)
  assert.doesNotMatch(r, /agent-browser|\bVite\b|5174|VITE_/)
  const przyklad = czytaj('.claude/templates/e2e-env/.env.e2e.example')
  assert.match(przyklad, /^EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=/m)
  assert.doesNotMatch(przyklad, /VITE_|agent-browser/)
})

test('wzór canary: stopApp przed każdym openLink, zmienne z adaptera, bez kont na sztywno', () => {
  const c = czytaj('.claude/templates/e2e-env/_canary.yaml')
  const kroki = c.split('\n').filter((l) => /^- (launchApp|stopApp|openLink)/.test(l)).map((l) => l.replace(/^- (\w+).*/, '$1'))
  assert.deepEqual(kroki, ['launchApp', 'stopApp', 'openLink', 'stopApp', 'openLink'])
  for (const z of ['${APP_ID}', '${APP_SCHEME}', '${METRO_URL}', '${MAESTRO_E2E_EMAIL}', '${MAESTRO_E2E_PASSWORD}']) assert.ok(c.includes(z), z)
  assert.doesNotMatch(c, /\$\{E2E_/, 'zmienna spoza prefiksu MAESTRO_ nie dojdzie do flow ze środowiska')
})

test('wzór canary przechodzi maestro check-syntax', { skip: spawnSync('maestro', ['--version']).error ? 'brak maestro' : false }, () => {
  const k = katalog()
  try {
    writeFileSync(join(k, '_canary.yaml'), czytaj('.claude/templates/e2e-env/_canary.yaml'))
    const w = spawnSync('maestro', ['check-syntax', join(k, '_canary.yaml')], { encoding: 'utf8' })
    assert.equal(w.status, 0, `${w.stdout}${w.stderr}`)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

// Bramka stacku Expo (IU-2.5, D14): kiedy biegnie expo-doctor i jak czyta jego wyjście. `npx` to atrapa w PATH z wyjściem prawdziwego
// expo-doctor 1.21.6 na zepsutym klonie spike-expo-58; próbę na prawdziwym narzędziu opisuje plan. Moduł biegnie z ławki.
//
// Uruchomienie: node --test stacks/expo/__tests__/bramka-doctor.test.mjs

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test, { after, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { przygotujLawke } from '../../testuj-wariant.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const { katalog: WARIANT, sprzataj } = przygotujLawke(KORZEN, 'expo')
after(sprzataj)
const { bramkaStacku, paczkiFazy, problemyDoctora, rozjazdyWersji } = await import(pathToFileURL(join(WARIANT, '.claude/scripts/bramki/stack.mjs')).href)

const WYJSCIE_PORAZKI = `Running 20 checks on your project...
18/20 checks passed. 2 checks failed. Possible issues detected:
Use the --verbose flag to see more details about passed checks.

✖ Check Expo config (app.json/ app.config.js) schema
Error validating fields in /x/app.json:
 Field: nieznanePole - Additional property "nieznanePole" is not allowed.
Advice:
Resolve schema errors in your app config.

✖ Check that packages match versions required by installed Expo SDK

❗ Major version mismatches
package     expected  found
expo-image  ~58.0.18  1.0.0

Advice:
Use 'npx expo install --check' to review and upgrade your dependencies.

2 checks failed, indicating possible issues with the project.
`
// Wyjście expo-doctor 1.21.x z kopii Nawykometru (pilot, run 2): 18 paczek SDK 55 ze starszym patchem, faza dodała tylko expo-haptics.
const WYJSCIE_ZASTANYCH = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'expo-doctor-zastane-patche.txt'), 'utf8')
const WYJSCIE_ZDROWE = 'Running 20 checks on your project...\n20/20 checks passed. No issues detected!\n'
const WYJSCIE_BLEDU = "Error: Cannot determine the project's Expo SDK version.\n"

const PATH_POCZATKOWY = process.env.PATH
afterEach(() => {
  process.env.PATH = PATH_POCZATKOWY
})

/** @param {string} wyjscie @param {number} kod @returns {string} plik zapisu argumentów atrapy */
function atrapaNpx(wyjscie, kod) {
  const katalog = mkdtempSync(join(tmpdir(), 'atrapa-npx-'))
  const dane = join(katalog, 'wyjscie.txt')
  const log = join(katalog, 'wywolanie.txt')
  writeFileSync(dane, wyjscie)
  writeFileSync(join(katalog, 'npx'), `#!/bin/sh\necho "$*" > '${log}'\ncat '${dane}'\nexit ${kod}\n`)
  chmodSync(join(katalog, 'npx'), 0o755)
  process.env.PATH = `${katalog}:${PATH_POCZATKOWY}`
  return log
}

/** @param {boolean} [konfiguracja] @returns {string} */
function projekt(konfiguracja = true) {
  const p = mkdtempSync(join(tmpdir(), 'expo-bramka-'))
  if (konfiguracja) writeFileSync(join(p, 'app.json'), '{"expo":{}}')
  return p
}

const ZALEZNOSCI = { pliki: ['package.json'], dodaneLinie: {}, diffU0: '' }

/** @param {string[]} wpisy linie dodane w package.json @returns {{ pliki: string[], dodaneLinie: {}, diffU0: string }} zmiany fazy z diffem -U0 */
const zmianaPaczek = (wpisy) => ({
  pliki: ['package.json', 'package-lock.json'],
  dodaneLinie: {},
  diffU0: [
    'diff --git a/package-lock.json b/package-lock.json', '--- a/package-lock.json', '+++ b/package-lock.json', '@@ -10 +10 @@', '+    "expo-router": "~55.0.18",',
    'diff --git a/package.json b/package.json', '--- a/package.json', '+++ b/package.json', '@@ -20 +20 @@', ...wpisy.map((w) => `+    ${w},`),
    'diff --git a/src/app/index.tsx b/src/app/index.tsx', '--- a/src/app/index.tsx', '+++ b/src/app/index.tsx', '@@ -1 +1 @@', '+const wersje = { "expo-sqlite": "x" }',
  ].join('\n'),
})

test('bramka: bez zmiany zależności i konfiguracji nie uruchamia narzędzia', () => {
  const log = atrapaNpx(WYJSCIE_PORAZKI, 1)
  const w = bramkaStacku(projekt(), { pliki: ['src/app/index.tsx'], dodaneLinie: {}, diffU0: '' })
  assert.deepEqual([w.status, w.powod], ['pominieta', 'faza nie zmieniła zależności ani konfiguracji aplikacji'])
  assert.throws(() => readFileSync(log), /ENOENT/)
})

test('bramka: katalog bez konfiguracji Expo (pakiet monorepo) jest pominięty', () => {
  const w = bramkaStacku(projekt(false), ZALEZNOSCI)
  assert.deepEqual([w.status, w.powod], ['pominieta', 'katalog bez konfiguracji Expo'])
})

test('bramka: każda zmiana z listy uruchamia expo-doctor@latest przez npx; czysty wynik = ok', () => {
  for (const plik of ['package.json', 'app.json', 'app.config.ts', 'metro.config.js', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock']) {
    const log = atrapaNpx(WYJSCIE_ZDROWE, 0)
    const w = bramkaStacku(projekt(), { pliki: [plik], dodaneLinie: {}, diffU0: '' })
    assert.equal(w.status, 'ok', plik)
    assert.deepEqual(w.trafienia, [])
    assert.equal(readFileSync(log, 'utf8').trim(), '--yes expo-doctor@latest')
  }
})

test('bramka: nieudane sprawdzenia = porażka z trafieniem na każde', () => {
  atrapaNpx(WYJSCIE_PORAZKI, 1)
  const w = bramkaStacku(projekt(), zmianaPaczek(['"expo-image": "1.0.0"']))
  assert.equal(w.status, 'porazka')
  assert.deepEqual(w.trafienia.map((/** @type {{ regula: string, plik: null, linia: null }} */ t) => [t.regula, t.plik, t.linia]), [['expo-doctor', null, null], ['expo-doctor', null, null]])
  assert.match(w.trafienia[0].opis, /^Check Expo config \(app\.json\/ app\.config\.js\) schema: Error validating fields .* nieznanePole/)
  assert.equal(w.trafienia[1].opis, 'Check that packages match versions required by installed Expo SDK: paczki zmienione w fazie: expo-image 1.0.0 (oczekiwana ~58.0.18). Naprawa: npx expo install <paczka>')
  assert.equal(w.ostrzezenia, undefined)
})

test('bramka: kod błędu bez nieudanych sprawdzeń = błąd narzędzia, nie defekt fazy', () => {
  atrapaNpx(WYJSCIE_BLEDU, 1)
  const w = bramkaStacku(projekt(), ZALEZNOSCI)
  assert.equal(w.status, 'blad')
  assert.deepEqual(w.trafienia, [])
  assert.match(w.powod, /^expo-doctor: kod 1, .*Cannot determine the project's Expo SDK version/)
})

test('problemyDoctora: wyjście bez znacznika to pusta lista', () => {
  assert.deepEqual(problemyDoctora(WYJSCIE_ZDROWE), [])
})

// --- rozjazd wersji: zastany a wprowadzony przez fazę (pilot Nawykometr, run 2) ---

test('bramka: rozjazd patchy sprzed fazy to ostrzeżenie i liczba zastanych, nie porażka', () => {
  atrapaNpx(WYJSCIE_ZASTANYCH, 1)
  const w = bramkaStacku(projekt(), zmianaPaczek(['"expo-haptics": "~55.0.18"']))
  assert.deepEqual([w.status, w.trafienia, w.zastane], ['ok', [], 18])
  assert.equal(w.ostrzezenia.length, 1)
  assert.match(w.ostrzezenia[0].opis, /18 paczek z rozjazdem sprzed fazy \(naprawa poza fazą, decyzja operatora: npx expo install --fix \(osobny commit, potem przebudowa dev-clienta\)\): expo 55\.0\.28 \(oczekiwana ~55\.0\.32\), expo-apple-authentication 55\.0\.15 \(oczekiwana ~55\.0\.17\)/)
})

test('bramka: paczka z listy zmieniona w fazie = porażka tylko na niej, reszta zastana', () => {
  atrapaNpx(WYJSCIE_ZASTANYCH, 1)
  const w = bramkaStacku(projekt(), zmianaPaczek(['"expo-haptics": "~55.0.18"', '"expo-sqlite": "~55.0.18"']))
  assert.equal(w.status, 'porazka')
  assert.deepEqual(w.trafienia.map((/** @type {{ opis: string }} */ t) => t.opis), ['Check that packages match versions required by installed Expo SDK: paczki zmienione w fazie: expo-sqlite 55.0.18 (oczekiwana ~55.0.20). Naprawa: npx expo install <paczka>'])
  assert.equal(w.zastane, 17)
  assert.doesNotMatch(w.ostrzezenia[0].opis, /expo-sqlite/)
})

test('bramka: zmiana wersji expo w fazie przesuwa oczekiwania wszystkich paczek, więc cały rozjazd jest porażką', () => {
  atrapaNpx(WYJSCIE_ZASTANYCH, 1)
  const w = bramkaStacku(projekt(), zmianaPaczek(['"expo": "~55.0.28"']))
  assert.equal(w.status, 'porazka')
  assert.match(w.trafienia[0].opis, /^Check that packages match versions required by installed Expo SDK: .*expo\s+~55\.0\.32\s+55\.0\.28 expo-apple-authentication/)
  assert.equal(w.ostrzezenia, undefined)
})

test('bramka: zmiana samego lockfile\'a albo konfiguracji nie wskazuje paczek fazy; inne nieudane sprawdzenie zostaje porażką', () => {
  atrapaNpx(WYJSCIE_ZASTANYCH, 1)
  assert.deepEqual([bramkaStacku(projekt(), { pliki: ['package-lock.json'], dodaneLinie: {}, diffU0: '' }).status], ['ok'])
  atrapaNpx(WYJSCIE_PORAZKI, 1)
  const w = bramkaStacku(projekt(), ZALEZNOSCI)
  assert.equal(w.status, 'porazka')
  assert.equal(w.trafienia.length, 1)
  assert.match(w.trafienia[0].opis, /^Check Expo config/)
  assert.equal(w.zastane, 1)
})

test('rozjazdyWersji: wiersze tabel patch i major, bez nagłówka, porad i odnośników', () => {
  const linie = WYJSCIE_ZASTANYCH.split('\n').map((l) => l.trim())
  const r = rozjazdyWersji(linie)
  assert.equal(r.length, 18)
  assert.deepEqual(r[0], { paczka: 'expo', oczekiwana: '~55.0.32', znaleziona: '55.0.28' })
  assert.deepEqual(r.at(-1), { paczka: 'jest-expo', oczekiwana: '~55.0.22', znaleziona: '55.0.20' })
  assert.deepEqual(rozjazdyWersji(['package     expected  found', '@expo/ui  ~58.0.2  58.0.1', '18 packages out of date.']), [{ paczka: '@expo/ui', oczekiwana: '~58.0.2', znaleziona: '58.0.1' }])
})

// --- uwaga bramki gotowości: wersje paczek SDK przed startem autopilota ---

const WYJSCIE_CHECK = `The following packages should be updated for best compatibility with the installed expo version:
  expo@55.0.28 - expected version: ~55.0.32
  expo-apple-authentication@55.0.15 - expected version: ~55.0.17
  expo-application@55.0.18 - expected version: ~55.0.19
  expo-asset@55.0.18 - expected version: ~55.0.20
  expo-build-properties@55.0.16 - expected version: ~55.0.18
  @expo/ui@55.0.1 - expected version: ~55.0.2
Your project may not work correctly until you install the expected versions of the packages.
`

test('gotowość: rozjazd paczek SDK to uwaga z liczbą, nazwami i komendą; zgodne wersje i projekt bez expo = brak uwagi', async () => {
  const { paczkiDoPodbicia, uwagaPaczekSdk } = await import(pathToFileURL(join(WARIANT, '.claude/scripts/e2e/expo-paczki.mjs')).href)
  assert.deepEqual(paczkiDoPodbicia(WYJSCIE_CHECK), ['expo', 'expo-apple-authentication', 'expo-application', 'expo-asset', 'expo-build-properties', '@expo/ui'])
  const bezExpo = projekt()
  const log = atrapaNpx(WYJSCIE_CHECK, 1)
  assert.equal(uwagaPaczekSdk(bezExpo), null)
  assert.throws(() => readFileSync(log), /ENOENT/, 'projekt bez node_modules/expo nie uruchamia narzędzia')
  const p = projekt()
  mkdirSync(join(p, 'node_modules', 'expo'), { recursive: true })
  assert.equal(uwagaPaczekSdk(p), '6 paczek SDK ma inną wersję, niż oczekuje zainstalowane Expo (expo, expo-apple-authentication, expo-application, expo-asset, expo-build-properties, …): faza zmieniająca zależności zgłosi je jako ostrzeżenie bramki stack. Podbicie przed startem to decyzja operatora: npx expo install --fix (osobny commit, potem przebudowa dev-clienta)')
  assert.equal(readFileSync(log, 'utf8').trim(), 'expo install --check')
  atrapaNpx('Dependencies are up to date\n', 0)
  assert.equal(uwagaPaczekSdk(p), null)
  atrapaNpx('fetch failed\n', 1)
  assert.equal(uwagaPaczekSdk(p), 'wersji paczek SDK nie sprawdzono (npx expo install --check: kod 1)')
})

test('paczkiFazy: tylko wpisy dodane w package.json projektu, nie w lockfile ani w kodzie', () => {
  assert.deepEqual([...paczkiFazy(zmianaPaczek(['"expo-haptics": "~55.0.18"', '"@expo/ui": "~58.0.2"']).diffU0)], ['expo-haptics', '@expo/ui'])
  assert.deepEqual([...paczkiFazy('')], [])
})

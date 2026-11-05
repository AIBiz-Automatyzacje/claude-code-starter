// Bramka stacku Expo (IU-2.5, D14): kiedy biegnie expo-doctor i jak czyta jego wyjście. `npx` to atrapa w PATH z wyjściem prawdziwego
// expo-doctor 1.21.6 na zepsutym klonie spike-expo-58; próbę na prawdziwym narzędziu opisuje plan. Moduł biegnie z ławki.
//
// Uruchomienie: node --test stacks/expo/__tests__/bramka-doctor.test.mjs

import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test, { after, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import { przygotujLawke } from '../../testuj-wariant.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const { katalog: WARIANT, sprzataj } = przygotujLawke(KORZEN, 'expo')
after(sprzataj)
const { bramkaStacku, problemyDoctora } = await import(pathToFileURL(join(WARIANT, '.claude/scripts/bramki/stack.mjs')).href)

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
  const w = bramkaStacku(projekt(), ZALEZNOSCI)
  assert.equal(w.status, 'porazka')
  assert.deepEqual(w.trafienia.map((/** @type {{ regula: string, plik: null, linia: null }} */ t) => [t.regula, t.plik, t.linia]), [['expo-doctor', null, null], ['expo-doctor', null, null]])
  assert.match(w.trafienia[0].opis, /^Check Expo config \(app\.json\/ app\.config\.js\) schema: Error validating fields .* nieznanePole/)
  assert.match(w.trafienia[1].opis, /^Check that packages match versions required by installed Expo SDK: .*expo-image {2}~58\.0\.18 {2}1\.0\.0.*expo install --check/)
  assert.doesNotMatch(w.trafienia[1].opis, /checks failed, indicating/)
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

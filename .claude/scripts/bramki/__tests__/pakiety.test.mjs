// Pakiety monorepo w fazie: bramki w korzeniu i w pakietach z wlasnymi narzedziami, wynik scalony ze sciezkami od korzenia.
// Smoke P6: kopia oferty-online ma migracje w korzeniu, a konfiguracje bramek w pakiecie packages/smoke-autopilot.

import { chmodSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { pakietyFazy, scalWyniki } from '../pakiety.mjs'
import { noweRepo, usun, zapisz } from './repo-testowe.mjs'

/** @param {string} repo @param {string} katalog */
function eslintW(repo, katalog) {
  zapisz(repo, { [`${katalog}/node_modules/.bin/eslint`]: '#!/bin/sh\n', [`${katalog}/eslint.config.js`]: 'export default []\n' })
  chmodSync(join(repo, katalog, 'node_modules', '.bin', 'eslint'), 0o755)
}

test('pakietyFazy: najblizszy package.json zmienionego pliku z narzedziem bramek; korzen i pakiety bez narzedzi pominiete', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { 'package.json': '{}', 'packages/a/package.json': '{}', 'packages/b/package.json': '{}', 'apps/c/package.json': '{}' })
    eslintW(repo, 'packages/a')
    eslintW(repo, 'apps/c')
    const pliki = ['packages/a/src/x.ts', 'packages/a/src/gleboko/y.ts', 'packages/b/src/z.ts', 'supabase/migrations/1.sql', 'README.md']
    assert.deepEqual(pakietyFazy(repo, pliki), ['packages/a'])
  } finally {
    usun(repo)
  }
})

test('scalWyniki: najgorszy status, suma czasu, trafienia ze sciezka od korzenia bez duplikatow, powody z katalogiem', () => {
  const t = (/** @type {string} */ plik) => ({ plik, linia: 3, regula: 'test-usuniety', opis: 'dodaje' })
  const wynik = scalWyniki([
    ['.', {
      eslint: { status: 'brak', sekundy: 0, trafienia: [], powod: 'brak node_modules/.bin/eslint (zaleznosc projektu)' },
      migracje: { status: 'porazka', sekundy: 0, trafienia: [{ plik: 'supabase/migrations/1.sql', linia: null, regula: 'niezmiennosc-migracji', opis: 'zmieniona' }] },
      testyUsuniete: { status: 'ok', sekundy: null, trafienia: [t('packages/a/src/x.test.ts')] },
    }],
    ['packages/a', {
      eslint: { status: 'porazka', sekundy: 1.5, trafienia: [{ plik: 'src/x.ts', linia: 4, regula: 'no-empty', opis: 'Empty block statement.' }], ostrzezenia: [] },
      migracje: { status: 'pominieta', sekundy: 0, trafienia: [], powod: 'projekt bez supabase/migrations' },
      testyUsuniete: { status: 'ok', sekundy: null, trafienia: [t('src/x.test.ts')] },
    }],
  ])
  assert.deepEqual(wynik.eslint, {
    status: 'porazka', sekundy: 1.5, ostrzezenia: [],
    trafienia: [{ plik: 'packages/a/src/x.ts', linia: 4, regula: 'no-empty', opis: 'Empty block statement.' }],
    powod: '.: brak node_modules/.bin/eslint (zaleznosc projektu)',
  })
  assert.equal(wynik.migracje.status, 'porazka')
  assert.equal(wynik.migracje.trafienia[0].plik, 'supabase/migrations/1.sql')
  assert.deepEqual(wynik.testyUsuniete.trafienia, [t('packages/a/src/x.test.ts')])
  assert.equal(wynik.testyUsuniete.sekundy, null)
})

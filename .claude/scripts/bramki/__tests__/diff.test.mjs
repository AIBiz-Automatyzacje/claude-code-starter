// Test zmian fazy: linie dodane wzgledem bazy (z plikami niezacommitowanymi i nieśledzonymi) i zakresy linii.

import test from 'node:test'
import assert from 'node:assert/strict'

import { parsujDiffU0, zakresy, zmianyFazy } from '../diff.mjs'
import { commit, noweRepo, usun, zapisz } from './repo-testowe.mjs'

test('parsujDiffU0: linie dodane po stronie nowej, plik usuniety bez wpisu', () => {
  const diff = [
    'diff --git a/src/a.ts b/src/a.ts',
    '--- a/src/a.ts',
    '+++ b/src/a.ts',
    '@@ -2 +2,2 @@',
    '-stara',
    '+nowa',
    '+nowa 2',
    '@@ -9,0 +11 @@',
    '+dopisana',
    '@@ -20,3 +22,0 @@',
    '-usunieta',
    'diff --git a/src/b.ts b/src/b.ts',
    '--- a/src/b.ts',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-cala',
  ].join('\n')
  assert.deepEqual(parsujDiffU0(diff), { 'src/a.ts': [2, 3, 11] })
})

test('zakresy: kolejne linie scalone, przerwa = nowy zakres', () => {
  assert.deepEqual(zakresy([2, 3, 4, 7, 9, 10]), [[2, 4], [7, 7], [9, 10]])
  assert.deepEqual(zakresy([]), [])
})

test('zmianyFazy: zmiany od bazy z commitow, z drzewa roboczego i pliki nieśledzone', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { 'src/a.ts': 'a1\na2\na3\n', 'src/stary.ts': 'x\n' })
    const baza = commit(repo, 'baza')
    zapisz(repo, { 'src/a.ts': 'a1\nzmiana\na3\n' })
    commit(repo, 'faza')
    zapisz(repo, { 'src/a.ts': 'a1\nzmiana\na3\nkoniec\n', 'src/nowy.ts': 'n1\nn2\n' })
    const z = zmianyFazy(repo, baza)
    assert.deepEqual(z.pliki, ['src/a.ts', 'src/nowy.ts'])
    assert.deepEqual(z.dodaneLinie, { 'src/a.ts': [2, 4], 'src/nowy.ts': [1, 2] })
    assert.deepEqual(z.diffU0.includes('+zmiana'), true)
  } finally {
    usun(repo)
  }
})

test('zmianyFazy: nieznana baza = blad z nazwa bazy', () => {
  const repo = noweRepo()
  try {
    assert.throws(() => zmianyFazy(repo, 'nie-ma-takiej'), /nie-ma-takiej/)
  } finally {
    usun(repo)
  }
})

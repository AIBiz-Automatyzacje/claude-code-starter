// Test wykrycia testow usunietych w fazie: definicja it(/test( usunieta z pliku testow, ktorej nazwy nie ma w zadnym obecnym
// pliku testow fazy (przeniesienie testu do innego pliku = nie usuniecie). Bramka informacyjna: lista, nie porazka.

import { rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { zmianyFazy } from '../diff.mjs'
import { bramkaTestyUsuniete, usunieteTesty } from '../testy-usuniete.mjs'
import { commit, noweRepo, usun, zapisz } from './repo-testowe.mjs'

test('usunieteTesty: nazwa i linia po stronie starej; nazwa obecna gdzie indziej = przeniesienie', () => {
  const diff = [
    'diff --git a/src/a.test.ts b/src/a.test.ts',
    '--- a/src/a.test.ts',
    '+++ b/src/a.test.ts',
    '@@ -4,3 +3,0 @@',
    "-it('odrzuca pusty tekst', () => {",
    '-  expect(f("")).toBe(null)',
    '-})',
    "@@ -10 +8 @@",
    "-  test.skip(\"przeniesiony\", () => {})",
    "+  // komentarz",
    'diff --git a/src/b.ts b/src/b.ts',
    '--- a/src/b.ts',
    '+++ b/src/b.ts',
    '@@ -1 +0,0 @@',
    "-it('to nie plik testow', () => {})",
  ].join('\n')
  assert.deepEqual(usunieteTesty(diff, new Set(['przeniesiony'])), [
    { plik: 'src/a.test.ts', linia: 4, regula: 'test-usuniety', opis: 'odrzuca pusty tekst' },
  ])
})

test('bramka na repo: test usuniety w commicie fazy i caly plik testow usuniety -> lista; bez usuniec -> pusta', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, {
      'src/a.test.ts': "import { it } from 'vitest'\n\nit('pierwszy', () => {})\nit('drugi', () => {})\n",
      'src/b.test.ts': "test('w pliku b', () => {})\n",
    })
    const baza = commit(repo, 'baza')
    zapisz(repo, { 'src/a.test.ts': "import { it } from 'vitest'\n\nit('pierwszy', () => {})\nit('trzeci', () => {})\n" })
    assert.deepEqual(bramkaTestyUsuniete(repo, zmianyFazy(repo, baza)).trafienia.map((t) => t.opis), ['drugi'])

    rmSync(join(repo, 'src', 'b.test.ts'))
    commit(repo, 'faza')
    const w = bramkaTestyUsuniete(repo, zmianyFazy(repo, baza))
    assert.equal(w.status, 'ok', 'bramka informacyjna nie daje porazki')
    assert.deepEqual(w.trafienia.map((t) => [t.plik, t.opis]), [['src/a.test.ts', 'drugi'], ['src/b.test.ts', 'w pliku b']])

    zapisz(repo, { 'src/a.test.ts': "import { it } from 'vitest'\n\nit('pierwszy', () => {})\nit('drugi', () => {})\n", 'src/b.test.ts': "test('w pliku b', () => {})\n" })
    assert.deepEqual(bramkaTestyUsuniete(repo, zmianyFazy(repo, baza)).trafienia, [])
  } finally {
    usun(repo)
  }
})

test('usunieteTesty: usunieta linia "-- komentarz SQL" nie jest naglowkiem pliku', () => {
  const diff = [
    'diff --git a/src/sql.test.ts b/src/sql.test.ts',
    'index 1111111..2222222 100644',
    '--- a/src/sql.test.ts',
    '+++ b/src/sql.test.ts',
    '@@ -3,2 +2,0 @@',
    '--- a/komentarz SQL w szablonie',
    "-it('po komentarzu', () => {})",
  ].join('\n')
  assert.deepEqual(usunieteTesty(diff, new Set()).map((t) => [t.plik, t.linia, t.opis]), [['src/sql.test.ts', 4, 'po komentarzu']])
})

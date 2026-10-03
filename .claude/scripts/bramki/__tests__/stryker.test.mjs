// Stryker diff-scoped: zakresy --mutate z linii dodanych w plikach produkcyjnych, ktorych test (x.test.ts obok x.ts) faza dotknela
// (funkcja czysta), oraz bramka na atrapie z nagranym raportem Strykera 10 (fixtures/stryker-*.json): przezyte mutanty = lista.

import { chmodSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { zmianyFazy } from '../diff.mjs'
import { wykryjNarzedzia } from '../narzedzia.mjs'
import { bramkaStryker, zakresyStrykera } from '../stryker.mjs'
import { argumentyAtrapy, atrapa, commit, noweRepo, usun, zapisz } from './repo-testowe.mjs'

test('zakresyStrykera: tylko pary test <-> plik produkcyjny z liniami fazy, zakresy scalone', () => {
  const zmiany = {
    pliki: ['src/a.ts', 'src/a.test.ts', 'src/b.ts', 'src/c.test.tsx', 'src/c.tsx', 'src/d.ts'],
    dodaneLinie: { 'src/a.ts': [1, 2, 3, 7], 'src/a.test.ts': [1], 'src/b.ts': [4], 'src/c.tsx': [10, 11], 'src/c.test.tsx': [2], 'src/d.ts': [1] },
    diffU0: '',
  }
  assert.deepEqual(zakresyStrykera(zmiany), ['src/a.ts:1-3', 'src/a.ts:7-7', 'src/c.tsx:10-11'])
})

test('zakresyStrykera: test zmieniony, plik produkcyjny bez linii fazy = brak zakresu', () => {
  const zmiany = { pliki: ['src/a.test.ts'], dodaneLinie: { 'src/a.test.ts': [3] }, diffU0: '' }
  assert.deepEqual(zakresyStrykera(zmiany), [])
})

const SUMA = 'export function suma(a: number, b: number): number {\n  if (a < 0) {\n    return 0\n  }\n  return a + b\n}\n'
const RAPORT = 'reports/mutation/mutation.json'

/** @returns {{ repo: string, baza: string }} */
function projekt() {
  const repo = noweRepo()
  zapisz(repo, { '.gitignore': 'node_modules\nreports\n', 'stryker.config.json': '{ "testRunner": "vitest" }\n' })
  atrapa(repo, {
    nazwa: 'stryker', znacznik: 'src/suma.test.ts', wzorzec: 'typeof', naruszenie: 'stryker-przezyte.json', czyste: 'stryker-czyste.json',
    kodNaruszenia: 0, plikWyjscia: RAPORT,
  })
  return { repo, baza: commit(repo, 'baza') }
}

/** @param {string} repo @param {string} baza */
function bramka(repo, baza) {
  const n = wykryjNarzedzia(repo).stryker
  assert.ok(n.jest)
  return bramkaStryker(repo, n, zmianyFazy(repo, baza))
}

test('test slaby -> przezyte mutanty z linia i mutatorem; test mocny -> pusta lista; raport sprzatniety', () => {
  const { repo, baza } = projekt()
  try {
    zapisz(repo, { 'src/suma.ts': SUMA, 'src/suma.test.ts': "it('dodaje', () => expect(typeof suma(2, 3)).toBe('number'))\n" })
    const slaby = bramka(repo, baza)
    assert.equal(slaby.status, 'ok', 'Stryker jest informacyjny — score nie jest celem')
    assert.equal(argumentyAtrapy(repo, 'stryker'), 'run --mutate src/suma.ts:1-6 --reporters json')
    assert.equal(slaby.trafienia.length, 6)
    assert.deepEqual(slaby.trafienia.find((t) => t.linia === 5), { plik: 'src/suma.ts', linia: 5, regula: 'stryker/ArithmeticOperator', opis: 'Survived: a - b' })
    assert.equal(existsSync(join(repo, RAPORT)), false)

    zapisz(repo, { 'src/suma.test.ts': "it('dodaje', () => expect(suma(2, 3)).toBe(5))\n" })
    assert.deepEqual(bramka(repo, baza).trafienia, [])
  } finally {
    usun(repo)
  }
})

test('faza bez pary test <-> kod = pominieta; Stryker bez raportu = blad', () => {
  const { repo, baza } = projekt()
  try {
    zapisz(repo, { 'src/suma.ts': SUMA })
    assert.equal(bramka(repo, baza).status, 'pominieta')

    zapisz(repo, { 'src/suma.test.ts': "it('x', () => {})\n" })
    writeFileSync(join(repo, 'node_modules', '.bin', 'stryker'), '#!/bin/sh\necho "ERROR Stryker Something went wrong in the initial test run" >&2\nexit 1\n')
    chmodSync(join(repo, 'node_modules', '.bin', 'stryker'), 0o755)
    const w = bramka(repo, baza)
    assert.equal(w.status, 'blad')
    assert.match(w.powod ?? '', /initial test run/)
  } finally {
    usun(repo)
  }
})

// Odbior bramki `vitest --typecheck`: atrapa vitest wypisuje nagrane wyjscie prawdziwego vitest 4.1.11 (fixtures/vitest-typecheck-*.json),
// wariant zalezny od tresci testu typow. Sprawdzamy wywolanie i odczyt: przejscie -> naruszenie -> porazka z testem -> przejscie.

import { chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { wykryjNarzedzia } from '../narzedzia.mjs'
import { bramkaVitestTypecheck } from '../vitest-typecheck.mjs'
import { argumentyAtrapy, atrapa, noweRepo, usun, zapisz } from './repo-testowe.mjs'

const TEST_TYPOW = (/** @type {string} */ typ) => `import { expectTypeOf, test } from 'vitest'
import { suma } from './suma'

test('typ wyniku', () => {
  expectTypeOf(suma(1, 2)).toEqualTypeOf<${typ}>()
})
`

/** @param {string} repo */
function bramka(repo) {
  const n = wykryjNarzedzia(repo).vitest
  assert.ok(n.jest)
  return bramkaVitestTypecheck(repo, n)
}

/** @returns {string} */
function projekt() {
  const repo = noweRepo()
  zapisz(repo, { '.gitignore': 'node_modules\n', 'src/suma.ts': 'export const suma = (a: number, b: number): number => a + b\n' })
  atrapa(repo, {
    nazwa: 'vitest', znacznik: 'src/suma.test-d.ts', wzorzec: 'toEqualTypeOf<string>',
    naruszenie: 'vitest-typecheck-naruszenie.json', czyste: 'vitest-typecheck-czyste.json',
  })
  return repo
}

test('bez plikow *.test-d.ts = pominieta (nie ma czego sprawdzac)', () => {
  const repo = projekt()
  try {
    const w = bramka(repo)
    assert.equal(w.status, 'pominieta')
    assert.match(w.powod ?? '', /test-d/)
  } finally {
    usun(repo)
  }
})

test('przejscie -> zly typ w tescie typow -> porazka z plikiem i nazwa testu -> przejscie', () => {
  const repo = projekt()
  try {
    zapisz(repo, { 'src/suma.test-d.ts': TEST_TYPOW('number') })
    assert.equal(bramka(repo).status, 'ok')
    assert.equal(argumentyAtrapy(repo, 'vitest'), 'run --typecheck.only --reporter=json')

    zapisz(repo, { 'src/suma.test-d.ts': TEST_TYPOW('string') })
    const w = bramka(repo)
    assert.equal(w.status, 'porazka')
    assert.deepEqual(w.trafienia.map((t) => [t.plik, t.regula]), [['src/suma.test-d.ts', 'vitest-typecheck']])
    assert.match(w.trafienia[0].opis, /^typ wyniku: .*Expected string, Actual number/)

    zapisz(repo, { 'src/suma.test-d.ts': TEST_TYPOW('number') })
    assert.equal(bramka(repo).status, 'ok')
  } finally {
    usun(repo)
  }
})

test('vitest bez raportu JSON = blad', () => {
  const repo = projekt()
  try {
    zapisz(repo, { 'src/suma.test-d.ts': TEST_TYPOW('number') })
    writeFileSync(join(repo, 'node_modules', '.bin', 'vitest'), '#!/bin/sh\necho "Startup Error: brak vitest.config" >&2\nexit 1\n')
    chmodSync(join(repo, 'node_modules', '.bin', 'vitest'), 0o755)
    const w = bramka(repo)
    assert.equal(w.status, 'blad')
    assert.match(w.powod ?? '', /Startup Error/)
  } finally {
    usun(repo)
  }
})

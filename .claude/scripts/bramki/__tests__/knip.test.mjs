// Odbior bramki knip: atrapa wypisuje nagrane wyjscie knip 6.38 (fixtures/knip-*.json). Trafienia tylko w plikach fazy,
// reszta = zastane (liczba). Przejscie -> nieuzywany eksport -> porazka knip/exports z linia -> przejscie.

import { chmodSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { zmianyFazy } from '../diff.mjs'
import { bramkaKnip } from '../knip.mjs'
import { wykryjNarzedzia } from '../narzedzia.mjs'
import { argumentyAtrapy, atrapa, commit, noweRepo, usun, zapisz } from './repo-testowe.mjs'

const SUMA = 'export function suma(a: number, b: number): number {\n  if (a < 0) {\n    return 0\n  }\n  return a + b\n}\n'

/** @returns {{ repo: string, baza: string }} */
function projekt() {
  const repo = noweRepo()
  zapisz(repo, { '.gitignore': 'node_modules\n', 'knip.json': '{}\n', 'src/suma.ts': SUMA, 'src/suma.test.ts': '', 'src/suma.test-d.ts': '' })
  atrapa(repo, { nazwa: 'knip', znacznik: 'src/suma.ts', wzorzec: 'nieuzywana', naruszenie: 'knip-naruszenie.json', czyste: 'knip-czyste.json' })
  return { repo, baza: commit(repo, 'baza') }
}

/** @param {string} repo @param {string} baza */
function bramka(repo, baza) {
  const n = wykryjNarzedzia(repo).knip
  assert.ok(n.jest)
  return bramkaKnip(repo, n, zmianyFazy(repo, baza))
}

test('przejscie -> nieuzywany eksport w pliku fazy -> porazka knip/exports -> przejscie; problemy spoza fazy = zastane', () => {
  const { repo, baza } = projekt()
  try {
    zapisz(repo, { 'src/suma.ts': `${SUMA}// faza\n` })
    assert.equal(bramka(repo, baza).status, 'ok')
    assert.equal(argumentyAtrapy(repo, 'knip'), '--reporter json --no-progress')

    zapisz(repo, { 'src/suma.ts': `${SUMA}\nexport const nieuzywana = 1\n` })
    const w = bramka(repo, baza)
    assert.equal(w.status, 'porazka')
    assert.deepEqual(w.trafienia, [{ plik: 'src/suma.ts', linia: 8, regula: 'knip/exports', opis: 'exports: nieuzywana' }])
    assert.equal(w.zastane, 2, 'nieuzywane pliki testow sprzed fazy')

    zapisz(repo, { 'src/suma.ts': `${SUMA}// faza\n` })
    assert.equal(bramka(repo, baza).status, 'ok')
  } finally {
    usun(repo)
  }
})

test('knip bez raportu JSON = blad', () => {
  const { repo, baza } = projekt()
  try {
    writeFileSync(join(repo, 'node_modules', '.bin', 'knip'), '#!/bin/sh\necho "ERROR: Unable to find package.json" >&2\nexit 2\n')
    chmodSync(join(repo, 'node_modules', '.bin', 'knip'), 0o755)
    const w = bramka(repo, baza)
    assert.equal(w.status, 'blad')
    assert.match(w.powod ?? '', /Unable to find package\.json/)
  } finally {
    usun(repo)
  }
})

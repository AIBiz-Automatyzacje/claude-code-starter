// Odbior bramki tsc na prawdziwym TypeScript szablonu: przejscie -> blad typu -> porazka z kodem TS i linia -> przejscie.

import { chmodSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { wykryjNarzedzia } from '../narzedzia.mjs'
import { bramkaTsc } from '../tsc.mjs'
import { FIXTURES, noweRepo, usun, zapisz } from './repo-testowe.mjs'

const NODE_MODULES_SZABLONU = resolve(FIXTURES, '..', '..', '..', '..', '..', 'node_modules')
const TSCONFIG = JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'es2023', module: 'nodenext', types: [] }, include: ['src'] })

/** @param {string} repo */
function bramka(repo) {
  const n = wykryjNarzedzia(repo).tsc
  assert.ok(n.jest, 'tsc szablonu niewykryty w fixture')
  return bramkaTsc(repo, n)
}

test('przejscie -> blad typu -> porazka TS2322 z plikiem i linia -> przejscie', () => {
  const repo = noweRepo()
  try {
    symlinkSync(NODE_MODULES_SZABLONU, join(repo, 'node_modules'))
    zapisz(repo, { 'tsconfig.json': TSCONFIG, 'src/a.ts': 'export const liczba: number = 1\n' })
    assert.equal(bramka(repo).status, 'ok')

    zapisz(repo, { 'src/a.ts': 'export const liczba: number = 1\nexport const tekst: string = liczba\n' })
    const w = bramka(repo)
    assert.equal(w.status, 'porazka')
    assert.deepEqual(w.trafienia.map((t) => [t.plik, t.linia, t.regula]), [['src/a.ts', 2, 'TS2322']])

    zapisz(repo, { 'src/a.ts': 'export const liczba: number = 1\n' })
    assert.equal(bramka(repo).status, 'ok')
  } finally {
    usun(repo)
  }
})

test('blad konfiguracji = porazka w tsconfig.json (tsc raportuje go jak blad pliku)', () => {
  const repo = noweRepo()
  try {
    symlinkSync(NODE_MODULES_SZABLONU, join(repo, 'node_modules'))
    zapisz(repo, { 'tsconfig.json': '{ "compilerOptions": { "target": "nie-ma-takiego" } }', 'src/a.ts': 'export const a = 1\n' })
    const w = bramka(repo)
    assert.equal(w.status, 'porazka')
    assert.deepEqual(w.trafienia.map((t) => [t.plik, t.regula]), [['tsconfig.json', 'TS6046']])
  } finally {
    usun(repo)
  }
})

test('tsc pada bez listy bledow = blad z wyjsciem narzedzia', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { 'tsconfig.json': '{}', 'node_modules/.bin/tsc': '#!/bin/sh\necho "Debug Failure. False expression." >&2\nexit 134\n' })
    chmodSync(join(repo, 'node_modules', '.bin', 'tsc'), 0o755)
    const w = bramka(repo)
    assert.equal(w.status, 'blad')
    assert.match(w.powod ?? '', /kod 134, Debug Failure/)
  } finally {
    usun(repo)
  }
})

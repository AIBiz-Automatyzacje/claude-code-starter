// Test wykrycia narzedzi projektu: bramka dostaje narzedzie tylko, gdy projekt ma i binarke w node_modules/.bin, i konfiguracje.

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { wykryjNarzedzia } from '../narzedzia.mjs'
import { noweRepo, usun, zapisz } from './repo-testowe.mjs'

/** @param {string} repo @param {string[]} nazwy */
function binarki(repo, nazwy) {
  mkdirSync(join(repo, 'node_modules', '.bin'), { recursive: true })
  for (const n of nazwy) {
    writeFileSync(join(repo, 'node_modules', '.bin', n), '#!/bin/sh\n')
    chmodSync(join(repo, 'node_modules', '.bin', n), 0o755)
  }
}

test('pusty projekt: kazde narzedzie z powodem braku', () => {
  const repo = noweRepo()
  try {
    const n = wykryjNarzedzia(repo)
    assert.equal(n.eslint.jest, false)
    assert.match(n.eslint.jest ? '' : n.eslint.powod, /node_modules\/\.bin\/eslint/)
    for (const nazwa of /** @type {const} */ (['tsc', 'vitest', 'knip', 'sizeLimit', 'stryker'])) assert.equal(n[nazwa].jest, false, nazwa)
  } finally {
    usun(repo)
  }
})

test('binarka bez konfiguracji = brak z nazwa brakujacego pliku; z konfiguracja = jest ze sciezkami', () => {
  const repo = noweRepo()
  try {
    binarki(repo, ['eslint', 'tsc', 'vitest', 'knip', 'size-limit', 'stryker'])
    const bez = wykryjNarzedzia(repo)
    assert.equal(bez.eslint.jest, false)
    assert.match(bez.eslint.jest ? '' : bez.eslint.powod, /eslint\.config/)
    assert.equal(bez.knip.jest, false)
    assert.equal(bez.vitest.jest, true, 'vitest nie wymaga pliku konfiguracji')

    zapisz(repo, {
      'eslint.config.ts': 'export default []\n',
      'tsconfig.json': '{}\n',
      'knip.json': '{}\n',
      '.size-limit.json': '[]\n',
      'stryker.config.json': '{}\n',
    })
    const z = wykryjNarzedzia(repo)
    assert.deepEqual(z.eslint, { jest: true, bin: join(repo, 'node_modules', '.bin', 'eslint'), konfiguracja: 'eslint.config.ts' })
    assert.equal(z.tsc.jest && z.tsc.konfiguracja, 'tsconfig.json')
    assert.equal(z.knip.jest && z.knip.konfiguracja, 'knip.json')
    assert.equal(z.sizeLimit.jest && z.sizeLimit.konfiguracja, '.size-limit.json')
    assert.equal(z.stryker.jest && z.stryker.konfiguracja, 'stryker.config.json')
  } finally {
    usun(repo)
  }
})

test('konfiguracja knip i size-limit w package.json', () => {
  const repo = noweRepo()
  try {
    binarki(repo, ['knip', 'size-limit'])
    zapisz(repo, { 'package.json': JSON.stringify({ knip: { entry: [] }, 'size-limit': [] }) })
    const n = wykryjNarzedzia(repo)
    assert.equal(n.knip.jest && n.knip.konfiguracja, 'package.json#knip')
    assert.equal(n.sizeLimit.jest && n.sizeLimit.konfiguracja, 'package.json#size-limit')
  } finally {
    usun(repo)
  }
})

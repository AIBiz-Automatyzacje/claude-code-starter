// Odbior bramki size-limit: atrapa wypisuje nagrane wyjscie size-limit 14 (fixtures/size-limit-*.json).
// Przejscie -> paczka ponad budzet -> porazka z nazwa pozycji i rozmiarem -> przejscie; rozmiar 0 = sciezka bez plikow = blad.
// Build przed pomiarem (decyzja operatora P6): skrypt `build` projektu odswieza dist, ktory mierzy @size-limit/file.

import { chmodSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { wykryjNarzedzia } from '../narzedzia.mjs'
import { bramkaSizeLimit } from '../size-limit.mjs'
import { argumentyAtrapy, atrapa, noweRepo, usun, zapisz } from './repo-testowe.mjs'

/** @param {string} repo */
function bramka(repo) {
  const n = wykryjNarzedzia(repo).sizeLimit
  assert.ok(n.jest)
  return bramkaSizeLimit(repo, n)
}

test('przejscie -> ponad budzet -> porazka size-limit z rozmiarem -> przejscie', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { '.size-limit.json': '[]\n', 'dist/app.js': 'maly\n' })
    atrapa(repo, { nazwa: 'size-limit', znacznik: 'dist/app.js', wzorzec: 'duzy', naruszenie: 'size-limit-naruszenie.json', czyste: 'size-limit-czyste.json' })
    assert.equal(bramka(repo).status, 'ok')
    assert.equal(argumentyAtrapy(repo, 'size-limit'), '--json')

    zapisz(repo, { 'dist/app.js': 'duzy\n' })
    const w = bramka(repo)
    assert.equal(w.status, 'porazka')
    assert.deepEqual(w.trafienia, [{ plik: null, linia: null, regula: 'size-limit', opis: 'app js: 5043 B > limit 1000 B' }])

    zapisz(repo, { 'dist/app.js': 'maly\n' })
    assert.equal(bramka(repo).status, 'ok')
  } finally {
    usun(repo)
  }
})

test('pozycja z rozmiarem 0 (sciezka bez plikow, np. brak builda) = blad, nie ciche przejscie', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { '.size-limit.json': '[]\n', 'dist/app.js': 'x\n' })
    atrapa(repo, { nazwa: 'size-limit', znacznik: 'dist/app.js', wzorzec: 'x', naruszenie: 'size-limit-brak-plikow.json', czyste: 'size-limit-czyste.json' })
    const w = bramka(repo)
    assert.equal(w.status, 'blad')
    assert.match(w.powod ?? '', /"x".*0 B/)
  } finally {
    usun(repo)
  }
})

test('size-limit zwraca obiekt bledu zamiast listy = blad z komunikatem', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, {
      '.size-limit.json': '[]\n',
      'node_modules/.bin/size-limit': '#!/bin/sh\necho \'{ "error": "Size Limit did not find files by dist/*.js" }\'\nexit 1\n',
    })
    chmodSync(join(repo, 'node_modules', '.bin', 'size-limit'), 0o755)
    const w = bramka(repo)
    assert.equal(w.status, 'blad')
    assert.match(w.powod ?? '', /did not find files/)
  } finally {
    usun(repo)
  }
})

// Build kopiuje src/app.js do dist/app.js — atrapa size-limit patrzy na dist, wiec wynik zalezy od tego, czy build pobiegl.
const BUILD_KOPIUJACY = 'node -e "require(\'node:fs\').mkdirSync(\'dist\',{recursive:true});require(\'node:fs\').copyFileSync(\'src/app.js\',\'dist/app.js\')"'

test('skrypt build projektu biegnie przed pomiarem: zmiana zrodla bez recznego builda = porazka', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, {
      '.size-limit.json': '[]\n',
      'package.json': JSON.stringify({ scripts: { build: BUILD_KOPIUJACY } }),
      'src/app.js': 'maly\n',
      'dist/app.js': 'maly\n',
    })
    atrapa(repo, { nazwa: 'size-limit', znacznik: 'dist/app.js', wzorzec: 'duzy', naruszenie: 'size-limit-naruszenie.json', czyste: 'size-limit-czyste.json' })
    assert.equal(bramka(repo).status, 'ok')

    zapisz(repo, { 'src/app.js': 'duzy\n' })
    const w = bramka(repo)
    assert.equal(w.status, 'porazka')
    assert.match(w.trafienia[0].opis, /> limit/)
  } finally {
    usun(repo)
  }
})

test('nieudany build = blad z koncowka wyjscia builda, size-limit nie biegnie', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, {
      '.size-limit.json': '[]\n',
      'package.json': JSON.stringify({ scripts: { build: 'node -e "console.error(\'vite: blad kompilacji\');process.exit(1)"' } }),
      'dist/app.js': 'maly\n',
    })
    atrapa(repo, { nazwa: 'size-limit', znacznik: 'dist/app.js', wzorzec: 'duzy', naruszenie: 'size-limit-naruszenie.json', czyste: 'size-limit-czyste.json' })
    const w = bramka(repo)
    assert.equal(w.status, 'blad')
    assert.match(w.powod ?? '', /build.*vite: blad kompilacji/s)
    assert.throws(() => argumentyAtrapy(repo, 'size-limit'), /ENOENT/)
  } finally {
    usun(repo)
  }
})

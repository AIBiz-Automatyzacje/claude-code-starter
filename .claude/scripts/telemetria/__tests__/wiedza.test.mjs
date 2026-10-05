// Klasy z regula w wiedzy projektu (P10) dla run.pr.klasy[].ma_regule: solutions z polami wiedzy, szczebel regula.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { klasyZRegula } from '../wiedza.mjs'

/** @param {string} klasa @param {string} szczebel @returns {string} */
function solution(klasa, szczebel) {
  return ['---', 'date: 2026-09-01', `klasa: ${klasa}`, 'regula: "Rob X, nie Y."', 'paths:', '  - src/**', 'waga: wysoka',
    `szczebel: ${szczebel}`, 'szczebel_powod: "osad"', 'zrodlo: "PR 3"', 'ucieczki: 1', '---', ''].join('\n')
}

test('klasyZRegula: tylko szczebel regula z poprawnymi polami; solution bez pol i archiwum pomijane', () => {
  const repo = mkdtempSync(join(tmpdir(), 'telemetria-wiedza-'))
  try {
    mkdirSync(join(repo, 'docs/solutions/a/_archived'), { recursive: true })
    writeFileSync(join(repo, 'docs/solutions/a/r.md'), solution('sciezka-bledu', 'regula'))
    writeFileSync(join(repo, 'docs/solutions/a/l.md'), solution('pii-i-sekrety', 'lint'))
    writeFileSync(join(repo, 'docs/solutions/a/stary.md'), '---\ntitle: "bez pol"\n---\n')
    writeFileSync(join(repo, 'docs/solutions/a/_archived/x.md'), solution('a11y', 'regula'))
    assert.deepEqual([...(klasyZRegula(repo) ?? [])], ['sciezka-bledu'])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('klasyZRegula: brak katalogu projektu = null (nie wiadomo), projekt bez solutions = pusty zbior', () => {
  assert.equal(klasyZRegula(null), null)
  assert.equal(klasyZRegula(join(tmpdir(), 'nie-ma-takiego-projektu-wiedza')), null)
  const repo = mkdtempSync(join(tmpdir(), 'telemetria-wiedza-'))
  try {
    assert.deepEqual([...(klasyZRegula(repo) ?? ['x'])], [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

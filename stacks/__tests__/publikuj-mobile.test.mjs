// Decyzja publikacji do repo mobile (IU-3.3): porównanie z SHA ostatniej publikacji, kolejność w historii, filtr ścieżek.
// Repo startera fikcyjne w katalogu tymczasowym.
//
// Uruchomienie: node --test stacks/__tests__/publikuj-mobile.test.mjs

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { decyzja, opublikowanySha } from '../publikuj-mobile.mjs'

const SKRYPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'publikuj-mobile.mjs')

/** @param {string} repo @param {string[]} argumenty */
const git = (repo, argumenty) => execFileSync('git', ['-C', repo, ...argumenty], { encoding: 'utf8' }).trim()

/** @param {string} repo @param {string} sciezka @param {string} tresc @returns {string} SHA nowego commitu */
function commit(repo, sciezka, tresc) {
  mkdirSync(dirname(join(repo, sciezka)), { recursive: true })
  writeFileSync(join(repo, sciezka), tresc)
  git(repo, ['add', '.'])
  git(repo, ['commit', '-q', '-m', sciezka])
  return git(repo, ['rev-parse', 'HEAD'])
}

// Historia: c1 (rdzeń) → c2 (tylko docs/) → c3 (.claude/) → c4 (stacks/); boczna gałąź z c1: c5.
function starter() {
  const repo = mkdtempSync(join(tmpdir(), 'publikuj-starter-'))
  git(repo, ['init', '-q'])
  git(repo, ['config', 'user.email', 't@t'])
  git(repo, ['config', 'user.name', 't'])
  const c1 = commit(repo, '.claude/a.md', 'a1')
  const c2 = commit(repo, 'docs/plan.md', 'plan')
  const c3 = commit(repo, '.claude/a.md', 'a2')
  const c4 = commit(repo, 'stacks/expo/usun.txt', 'x')
  git(repo, ['checkout', '-q', '-b', 'boczna', c1])
  const c5 = commit(repo, 'output-styles/s.md', 's')
  return { repo, c1, c2, c3, c4, c5 }
}

/** @param {string | null} tresc @returns {string} katalog repo mobile */
function mobile(tresc) {
  const k = mkdtempSync(join(tmpdir(), 'publikuj-mobile-'))
  if (tresc !== null) {
    mkdirSync(join(k, '.claude'))
    writeFileSync(join(k, '.claude/.rdzen-version'), tresc)
  }
  return k
}

test('pierwsza publikacja: repo mobile bez SHA rdzenia → publikuj', () => {
  const s = starter()
  assert.equal(decyzja({ starter: s.repo, opublikowany: null, sha: s.c1 }).decyzja, 'publikuj')
})

test('ten sam SHA już opublikowany → bez-zmian', () => {
  const s = starter()
  assert.equal(decyzja({ starter: s.repo, opublikowany: s.c3, sha: s.c3 }).decyzja, 'bez-zmian')
})

test('od publikacji zmiany tylko poza .claude/, output-styles/ i stacks/ → bez-zmian', () => {
  const s = starter()
  const wynik = decyzja({ starter: s.repo, opublikowany: s.c1, sha: s.c2 })
  assert.deepEqual(wynik, { decyzja: 'bez-zmian', powod: `od ${s.c1} brak zmian w .claude, output-styles, stacks` })
})

test('zmiana w .claude/ albo w stacks/ od publikacji → publikuj, także przez pominięte pushe', () => {
  const s = starter()
  assert.equal(decyzja({ starter: s.repo, opublikowany: s.c2, sha: s.c3 }).decyzja, 'publikuj')
  assert.equal(decyzja({ starter: s.repo, opublikowany: s.c3, sha: s.c4 }).decyzja, 'publikuj')
  assert.equal(decyzja({ starter: s.repo, opublikowany: s.c1, sha: s.c4 }).decyzja, 'publikuj')
})

test('SHA starszy od opublikowanego → starszy, bez nadpisania nowszej publikacji', () => {
  const s = starter()
  const wynik = decyzja({ starter: s.repo, opublikowany: s.c4, sha: s.c2 })
  assert.deepEqual(wynik, { decyzja: 'starszy', powod: `${s.c2} jest starszy niż opublikowany ${s.c4}` })
})

test('opublikowany SHA spoza historii albo z bocznej gałęzi → publikuj z powodem', () => {
  const s = starter()
  const obcy = 'f'.repeat(40)
  assert.deepEqual(decyzja({ starter: s.repo, opublikowany: obcy, sha: s.c3 }), {
    decyzja: 'publikuj',
    powod: `opublikowany ${obcy} nie istnieje w historii startera`,
  })
  assert.match(decyzja({ starter: s.repo, opublikowany: s.c5, sha: s.c3 }).powod, /przepisana historia/)
})

test('SHA do publikacji skrócony → TypeError przed wołaniem gita', () => {
  const s = starter()
  assert.throws(() => decyzja({ starter: s.repo, opublikowany: null, sha: s.c1.slice(0, 7) }), TypeError)
})

test('opublikowanySha: pełny SHA z pliku; brak pliku, -dirty i śmieci → null', () => {
  const sha = 'a'.repeat(40)
  assert.equal(opublikowanySha(mobile(`${sha}\n`)), sha)
  assert.equal(opublikowanySha(mobile(null)), null)
  assert.equal(opublikowanySha(mobile(`${sha}-dirty\n`)), null)
  assert.equal(opublikowanySha(mobile('6fbd49d\n')), null)
})

test('CLI: decyzja=<wynik> na stdout do $GITHUB_OUTPUT, powód na stderr; złe argumenty → kod 2', () => {
  const s = starter()
  const w = spawnSync(process.execPath, [SKRYPT, s.repo, mobile(`${s.c1}\n`), s.c3], { encoding: 'utf8' })
  assert.equal(w.status, 0, w.stderr)
  assert.equal(w.stdout, 'decyzja=publikuj\n')
  assert.equal(w.stderr.trim(), `zmiany w .claude, output-styles, stacks od ${s.c1}`)
  assert.equal(spawnSync(process.execPath, [SKRYPT, s.repo], { encoding: 'utf8' }).status, 2)
  assert.equal(spawnSync(process.execPath, [SKRYPT, s.repo, mobile(null), 'abc'], { encoding: 'utf8' }).status, 2)
})

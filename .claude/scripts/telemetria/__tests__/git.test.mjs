// Test odczytu zmian commitow fixa (It. 1, krok 2; D12: pliki fixa ze statusem A/M).

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { zmianyCommitow } from '../git.mjs'

/** @param {string} repo @param {string[]} argumenty */
const git = (repo, argumenty) => execFileSync('git', ['-C', repo, ...argumenty], { encoding: 'utf8' }).trim()

function repoZFixem() {
  const repo = mkdtempSync(join(tmpdir(), 'telemetria-git-'))
  git(repo, ['init', '-q'])
  git(repo, ['config', 'user.email', 't@t'])
  git(repo, ['config', 'user.name', 't'])
  writeFileSync(join(repo, 'a.ts'), 'linia 1\nlinia 2\n')
  git(repo, ['add', '.'])
  git(repo, ['commit', '-q', '-m', 'feat'])
  writeFileSync(join(repo, 'a.ts'), 'linia 1\nzmieniona\nnowa\n')
  writeFileSync(join(repo, 'b.test.ts'), 'test\n')
  git(repo, ['add', '.'])
  git(repo, ['commit', '-q', '-m', 'fix(x): poprawki po review fazy 1'])
  return { repo, sha: git(repo, ['rev-parse', '--short', 'HEAD']) }
}

test('pliki fixa ze statusem A/M i linie diffu', () => {
  const { repo, sha } = repoZFixem()
  try {
    const z = zmianyCommitow(repo, [sha])
    assert.ok(z.ok)
    assert.deepEqual(z.pliki, [{ plik: 'a.ts', status: 'M' }, { plik: 'b.test.ts', status: 'A' }])
    assert.deepEqual(z.linie, { plus: 3, minus: 1 })
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('commit nieosiagalny: wynik z powodem, nie wyjatek', () => {
  const { repo } = repoZFixem()
  try {
    const z = zmianyCommitow(repo, ['deadbeef'])
    assert.equal(z.ok, false)
    assert.ok(!z.ok && z.powod.length > 0)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('brak commitow fixa: pusta lista, bez wywolania gita', () => {
  assert.deepEqual(zmianyCommitow('/nie/istnieje', []), { ok: true, pliki: [], linie: { plus: 0, minus: 0 } })
})

test('nieznany katalog projektu przy commitach fixa: wynik z powodem', () => {
  assert.deepEqual(zmianyCommitow(null, ['abc']), { ok: false, powod: 'nieznany katalog projektu' })
})

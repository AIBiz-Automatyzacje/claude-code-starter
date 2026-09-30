// Test skryptu kopii do smoke'a (PLAN-POPRAWY P0): skladnia (`bash -n`) i bieg `--dry-run`, ktory pokazuje kroki i niczego nie tworzy.
// Pelny bieg (clone, pnpm install, sync) sprawdza smoke paczki — tu bez sieci i bez instalacji.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const SKRYPT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'przygotuj-kopie.sh')

/**
 * @param {{ workspace: boolean }} opcje
 * @returns {string}
 */
function projektZrodlowy({ workspace }) {
  const katalog = mkdtempSync(join(tmpdir(), 'smoke-zrodlo-'))
  const git = (/** @type {string[]} */ argumenty) => execFileSync('git', ['-C', katalog, ...argumenty])
  git(['init', '-q'])
  git(['config', 'user.email', 't@t'])
  git(['config', 'user.name', 't'])
  writeFileSync(join(katalog, 'package.json'), '{}\n')
  if (workspace) writeFileSync(join(katalog, 'pnpm-workspace.yaml'), "packages:\n  - 'packages/*'\n")
  git(['add', '.'])
  git(['commit', '-q', '-m', 'start'])
  return katalog
}

/**
 * @param {string[]} argumenty
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 */
const uruchom = (argumenty) => spawnSync('bash', [SKRYPT, ...argumenty], { encoding: 'utf8' })

test('przygotuj-kopie.sh: skladnia bash poprawna', () => {
  const wynik = spawnSync('bash', ['-n', SKRYPT], { encoding: 'utf8' })
  assert.equal(wynik.status, 0, wynik.stderr)
})

test('--dry-run na projekcie pnpm workspace: pokazuje kroki z pakietem fixture i niczego nie tworzy', () => {
  const zrodlo = projektZrodlowy({ workspace: true })
  const kopia = join(tmpdir(), `smoke-kopia-${process.pid}-a`)
  try {
    const wynik = uruchom([zrodlo, kopia, '--dry-run'])
    assert.equal(wynik.status, 0, wynik.stdout + wynik.stderr)
    for (const krok of ['clone', 'remote remove origin', 'test/smoke-autopilot', '.claude/.backups/', 'sync-template.sh',
      'packages/smoke-autopilot', 'pnpm install', 'commit --quiet -m']) {
      assert.ok(wynik.stdout.includes(krok), `brak kroku "${krok}" w:\n${wynik.stdout}`)
    }
    assert.equal(existsSync(kopia), false, 'dry-run utworzyl katalog kopii')
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
  }
})

test('--dry-run bez pnpm-workspace.yaml: kod zadania w src/lib, bez pakietu fixture', () => {
  const zrodlo = projektZrodlowy({ workspace: false })
  try {
    const wynik = uruchom([zrodlo, join(tmpdir(), `smoke-kopia-${process.pid}-b`), '--dry-run'])
    assert.equal(wynik.status, 0, wynik.stdout + wynik.stderr)
    assert.match(wynik.stdout, /Kod zadania: src\/lib$/m)
    assert.doesNotMatch(wynik.stdout, /packages\/smoke-autopilot/)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
  }
})

test('istniejacy katalog kopii: blad bez zadnego kroku', () => {
  const zrodlo = projektZrodlowy({ workspace: true })
  try {
    const wynik = uruchom([zrodlo, zrodlo, '--dry-run'])
    assert.equal(wynik.status, 4)
    assert.match(wynik.stderr, /już istnieje/)
    assert.doesNotMatch(wynik.stdout, /^\+ /m)
  } finally {
    rmSync(zrodlo, { recursive: true, force: true })
  }
})

// Test rekordu `run.szablon` (It. 1, krok 3): ktora wersja maszynerii sie wykonala.
// Przeglad D5 §8 pkt 3: 33/55 runow autopilota wykonalo skrypt spoza historii szablonu; marker brak w 6/11 repo.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { hashBloba, wersjaSzablonu } from '../szablon.mjs'

const SKRYPT = "export const meta = { name: 'dev-autopilot-wf' }\nlog('zażółć')\n"
const DZIECKO = "export const meta = { name: 'dev-docs-review-wf' }\n"

test('hash bloba = git hash-object (takze z polskimi znakami)', () => {
  const plik = join(mkdtempSync(join(tmpdir(), 'telemetria-hash-')), 'x.js')
  try {
    writeFileSync(plik, SKRYPT)
    assert.equal(hashBloba(SKRYPT), execFileSync('git', ['hash-object', plik], { encoding: 'utf8' }).trim())
  } finally {
    rmSync(plik, { force: true })
  }
})

/** @param {{ hashe?: boolean, marker?: boolean }} opcje */
function projekt(opcje) {
  const repo = mkdtempSync(join(tmpdir(), 'telemetria-szablon-'))
  mkdirSync(join(repo, '.claude', 'workflows'), { recursive: true })
  writeFileSync(join(repo, '.claude', 'workflows', 'dev-autopilot-wf.js'), SKRYPT)
  writeFileSync(join(repo, '.claude', 'workflows', 'dev-docs-review-wf.js'), DZIECKO)
  if (opcje.marker) writeFileSync(join(repo, '.claude', '.template-version'), 'abc1234def\n')
  if (opcje.hashe) {
    writeFileSync(join(repo, '.claude', '.template-hashes'), [
      `${hashBloba(SKRYPT)}\t.claude/workflows/dev-autopilot-wf.js`,
      `${hashBloba(DZIECKO)}\t.claude/workflows/dev-docs-review-wf.js`,
    ].join('\n') + '\n')
  }
  // Pliki starsze niz start runu — inaczej kazdy test widzialby „zmienione po starcie”.
  for (const p of ['dev-autopilot-wf.js', 'dev-docs-review-wf.js']) utimesSync(join(repo, '.claude', 'workflows', p), 1, 1)
  return repo
}

const WE = { workflowName: 'dev-autopilot-wf', skrypt: SKRYPT, startMs: 10_000 }

test('skrypt z szablonu: marker, hash, zgodny, dzieci niezmienione', () => {
  const repo = projekt({ hashe: true, marker: true })
  try {
    assert.deepEqual(wersjaSzablonu({ ...WE, repo }), { marker: 'abc1234def', skrypt_sha: hashBloba(SKRYPT), zgodny: true, dzieci_zmienione: false })
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('skrypt zmieniony o jeden znak: zgodny false', () => {
  const repo = projekt({ hashe: true, marker: true })
  try {
    assert.equal(wersjaSzablonu({ ...WE, repo, skrypt: SKRYPT + ' ' }).zgodny, false)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('dziecko zmienione lokalnie: dzieci_zmienione true', () => {
  const repo = projekt({ hashe: true, marker: true })
  try {
    writeFileSync(join(repo, '.claude', 'workflows', 'dev-docs-review-wf.js'), DZIECKO + '// lokalna zmiana\n')
    utimesSync(join(repo, '.claude', 'workflows', 'dev-docs-review-wf.js'), 1, 1)
    assert.equal(wersjaSzablonu({ ...WE, repo }).dzieci_zmienione, true)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('dziecko nadpisane po starcie runu: dzieci_zmienione true (mtime)', () => {
  const repo = projekt({ hashe: true, marker: true })
  try {
    utimesSync(join(repo, '.claude', 'workflows', 'dev-docs-review-wf.js'), 20, 20)
    assert.equal(wersjaSzablonu({ ...WE, repo }).dzieci_zmienione, true)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('bez pliku hashy i markera: zgodnosc nieznana (null), hash skryptu jest', () => {
  const repo = projekt({})
  try {
    assert.deepEqual(wersjaSzablonu({ ...WE, repo }), { marker: null, skrypt_sha: hashBloba(SKRYPT), zgodny: null, dzieci_zmienione: null })
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('run bez pliku harnessu (brak skryptu) i bez repo: same null', () => {
  assert.deepEqual(wersjaSzablonu({ workflowName: null, skrypt: null, startMs: null, repo: null }), {
    marker: null, skrypt_sha: null, zgodny: null, dzieci_zmienione: null,
  })
})

// Commity po archiwizacji zadania (P22 B4) na repo-fixturze: archiwum, commit pipeline'u (części PR), smoke operatora
// z poprawkami kodu i tura napraw /dev-pr. Przypadek z vibersi etap 4: 15 commitow z kodem po archiwum 2ad523b (naklejka
// odznaki, poprawki serwera) — tylko bot PR je widzial.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { plikKodu, poArchiwum } from '../po-archiwum.mjs'

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'po-archiwum.mjs')
const Z = 'etap-4'
const PODSUMOWANIE = `# Podsumowanie\n\n## Części PR (2)\r\n\n| Część | Fazy | Od | Do | Plików do recenzji |\n|---|---|---|---|---|\n| 1 | 1–3 | aaa | bbb | 93 |\n| 2 | 4–6 | bbb | czubek gałęzi | 121 |\n`

/** @param {string} k @param {string[]} a */
const git = (k, a) => {
  const w = spawnSync('git', ['-C', k, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' })
  assert.equal(w.status, 0, w.stderr)
  return w.stdout.trim()
}

/** @param {string} k @param {string} temat @param {Record<string, string>} pliki @returns {string} sha */
function commit(k, temat, pliki) {
  for (const [p, t] of Object.entries(pliki)) {
    mkdirSync(dirname(join(k, p)), { recursive: true })
    writeFileSync(join(k, p), t)
  }
  git(k, ['add', '-A'])
  git(k, ['commit', '-qm', temat])
  return git(k, ['rev-parse', 'HEAD'])
}

/** @param {{ archiwum?: boolean, czesci?: boolean }} [o] @returns {{ k: string, sha: Record<string, string> }} */
function repo(o = {}) {
  const k = mkdtempSync(join(tmpdir(), 'po-archiwum-'))
  git(k, ['init', '-q', '-b', 'main'])
  commit(k, 'start', { 'README.md': '#\n' })
  git(k, ['switch', '-qc', `feature/${Z}`])
  /** @type {Record<string, string>} */
  const sha = {}
  sha.faza = commit(k, `feat(${Z}): faza 1`, { 'src/a.ts': 'a\n' })
  if (o.archiwum !== false) sha.archiwum = commit(k, `docs(${Z}): archiwum`, { [`docs/completed/${Z}/${Z}-podsumowanie.md`]: '# P\n' })
  if (o.czesci !== false) commit(k, `docs(${Z}): części PR w podsumowaniu`, { [`docs/completed/${Z}/${Z}-podsumowanie.md`]: PODSUMOWANIE })
  sha.smoke = commit(k, 'docs(smoke): sekcja 1 OK', { 'docs/operator/smoke.md': '- [x]\n' })
  sha.serwer = commit(k, 'fix(serwer): pliki odznaki podawane', { 'server/odznaka.ts': 'x\n', 'docs/operator/smoke.md': '- [x] 2\n' })
  sha.naklejka = commit(k, 'feat(odznaka): naklejka', { 'src/odznaka/naklejka.tsx': 'x\n', 'src/odznaka/naklejka.test.tsx': 'x\n', '.claude/skills/weryfikacja/mapa-funkcji.md': 'x\n' })
  commit(k, 'fix(pr): tura 1 — poprawki po review bota', { 'src/b.ts': 'b\n' })
  return { k, sha }
}

test('commity po archiwum bez tematow pipeline\'u; pliki kodu poza docs/ i .claude/ (vibersi etap 4: smoke z kodem)', () => {
  const { k, sha } = repo()
  try {
    const w = poArchiwum(k, { zadanie: Z, czesc: 2 })
    assert.equal(w.archiwum, sha.archiwum)
    assert.deepEqual(w.commity.map((c) => c.temat), ['docs(smoke): sekcja 1 OK', 'fix(serwer): pliki odznaki podawane', 'feat(odznaka): naklejka'])
    assert.deepEqual(w.commity.map((c) => c.plikiKodu), [[], ['server/odznaka.ts'], ['src/odznaka/naklejka.test.tsx', 'src/odznaka/naklejka.tsx']])
    assert.deepEqual(w.plikiKodu, ['server/odznaka.ts', 'src/odznaka/naklejka.test.tsx', 'src/odznaka/naklejka.tsx'])
    assert.equal(w.zakres, `${sha.archiwum?.slice(0, 12)}..feature/${Z}`)
    assert.deepEqual([w.czesci, w.wTejCzesci], [2, true])
    assert.equal(poArchiwum(k, { zadanie: Z, czesc: 1 }).wTejCzesci, false)
    assert.equal(poArchiwum(k, { zadanie: Z }).wTejCzesci, true)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('zadanie bez commitu archiwum → archiwum null i pusta lista; jeden PR (bez tabeli czesci) → czesci null', () => {
  const bez = repo({ archiwum: false })
  try {
    assert.deepEqual(poArchiwum(bez.k, { zadanie: Z }), { ok: true, archiwum: null, galaz: `feature/${Z}`, zakres: null, czesci: 2, wTejCzesci: true, commity: [], plikiKodu: [] })
  } finally {
    rmSync(bez.k, { recursive: true, force: true })
  }
  const jeden = repo({ czesci: false })
  try {
    const w = poArchiwum(jeden.k, { zadanie: Z, czesc: 1 })
    assert.deepEqual([w.czesci, w.wTejCzesci, w.commity.length], [null, true, 3])
  } finally {
    rmSync(jeden.k, { recursive: true, force: true })
  }
})

test('archiwum innego zadania o wspolnym prefiksie nazwy sie nie liczy; plikKodu', () => {
  const { k } = repo({ archiwum: false })
  try {
    commit(k, `docs(${Z}-bis): archiwum`, { 'x.md': 'x\n' })
    commit(k, `Revert "docs(${Z}): archiwum"`, { 'y.md': 'y\n' })
    commit(k, `docs(${Z}): archiwum (ponowne)`, { 'z.md': 'z\n' })
    assert.equal(poArchiwum(k, { zadanie: Z }).archiwum, null)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
  assert.deepEqual(['docs/a.md', '.claude/x.mjs', 'src/a.ts', 'e2e/s.sh', 'docsy/a.ts'].map(plikKodu), [false, false, true, true, true])
})

test('CLI: JSON w jednej linii; zla nazwa zadania i --czesc = kod 2', () => {
  const { k } = repo()
  try {
    const w = spawnSync(process.execPath, [CLI, '--zadanie', Z, '--czesc', '2', '--projekt', k], { encoding: 'utf8' })
    assert.equal(w.status, 0, w.stderr)
    assert.equal(JSON.parse(w.stdout).plikiKodu.length, 3)
    assert.equal(spawnSync(process.execPath, [CLI, '--zadanie', "x'; rm", '--projekt', k]).status, 2)
    assert.equal(spawnSync(process.execPath, [CLI, '--zadanie', Z, '--czesc', '0', '--projekt', k]).status, 2)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('CLI z katalogu ze spacja w sciezce (URL modulu zakodowany) — wynik zamiast pustego stdout', () => {
  const { k } = repo()
  const zSpacja = mkdtempSync(join(tmpdir(), 'po archiwum '))
  try {
    const kopia = join(zSpacja, 'po-archiwum.mjs')
    writeFileSync(kopia, readFileSync(CLI, 'utf8'))
    const w = spawnSync(process.execPath, [kopia, '--zadanie', Z, '--projekt', k], { encoding: 'utf8' })
    assert.equal(JSON.parse(w.stdout).plikiKodu.length, 3)
  } finally {
    rmSync(k, { recursive: true, force: true })
    rmSync(zSpacja, { recursive: true, force: true })
  }
})

// Rozmiar PR do recenzji bota (P19). vibersi etap 2: archiwizacja liczyla 250 plikow diffu i radzila podzial PR-a, a bot
// recenzowal 124 (filtry .coderabbit.yaml: docs/, .claude/, lockfile, public/; obrazy binarne) — PR #2 przeszedl w calosci.
// Fixture: `git diff --numstat -z -M bdd35ce 1457e5d` (start etapu 2 -> commit archiwum) i .coderabbit.yaml z tego commita.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import test from 'node:test'

import { doRecenzji, filtrySciezek, plikiNumstat, regexGlobu } from '../rozmiar.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = join(KATALOG, '..', 'rozmiar.mjs')
const fixture = (/** @type {string} */ nazwa) => readFileSync(join(KATALOG, 'fixtures', nazwa), 'utf8')

test('vibersi etap 2: 250 plikow diffu -> 83 binarne, 43 odfiltrowane, 124 do recenzji bota', () => {
  const filtry = filtrySciezek(fixture('vibersi-etap2-coderabbit.yaml'))
  assert.deepEqual(filtry, ['!node_modules/**', '!docs/**', '!.claude/**', '!package-lock.json', '!*.lock', '!pnpm-lock.yaml', '!dist/**', '!build/**', '!public/**', '!**/database.types.ts'])
  const pliki = plikiNumstat(fixture('vibersi-etap2-numstat.z'))
  const tekstowe = pliki.filter((p) => !p.binarny)
  const recenzja = tekstowe.filter((p) => doRecenzji(p.plik, filtry))
  assert.deepEqual([pliki.length, pliki.length - tekstowe.length, tekstowe.length - recenzja.length, recenzja.length], [250, 83, 43, 124])
  assert.ok(recenzja.some((p) => p.plik.startsWith('src/')) && !recenzja.some((p) => /^(docs|\.claude|public)\//.test(p.plik)))
})

test('glob jak minimatch: ** przez katalogi (takze zero), * i ? bez /, {a,b}; wzorce bez ! zawezaja liste', () => {
  assert.equal(regexGlobu('**/database.types.ts').test('database.types.ts'), true)
  assert.equal(regexGlobu('**/database.types.ts').test('src/lib/database.types.ts'), true)
  assert.equal(regexGlobu('*.lock').test('bun.lock'), true)
  assert.equal(regexGlobu('*.lock').test('a/bun.lock'), false)
  assert.equal(regexGlobu('src/**/*.{ts,tsx}').test('src/a/b/c.tsx'), true)
  assert.equal(regexGlobu('src/**/*.{ts,tsx}').test('src/a.css'), false)
  assert.equal(regexGlobu('a?.md').test('ab.md'), true)
  assert.equal(regexGlobu('docs/**').test('docs.md'), false)
  assert.equal(doRecenzji('src/a.ts', ['src/**', '!src/gen/**']), true)
  assert.equal(doRecenzji('src/gen/a.ts', ['src/**', '!src/gen/**']), false)
  assert.equal(doRecenzji('server/a.ts', ['src/**']), false)
  assert.equal(doRecenzji('cokolwiek', []), true)
})

test('filtry z YAML bez pakietu yaml: komentarze w liscie, lista w linii, brak bloku reviews albo path_filters = brak filtrow', () => {
  assert.deepEqual(filtrySciezek('reviews:\n  profile: chill\n  path_filters:\n    # wspolne\n    - "!docs/**"\n\n    - \'!a.md\'  # komentarz\n    - src/**\n  path_instructions:\n    - path: "x"\n'), ['!docs/**', '!a.md', 'src/**'])
  assert.deepEqual(filtrySciezek('reviews:\n  path_filters: ["!docs/**", \'!b\']\n'), ['!docs/**', '!b'])
  assert.deepEqual(filtrySciezek('language: pl\npath_filters:\n  - "!x"\nreviews:\n  profile: chill\nchat:\n  path_filters:\n    - "!y"\n'), [])
  assert.deepEqual(filtrySciezek(''), [])
})

test('CLI na repo: binarny plik i plik z filtra odpadaja, zmiana nazwy = jeden plik; brak .coderabbit.yaml = tylko binaria', () => {
  const repo = mkdtempSync(join(tmpdir(), 'rozmiar-pr-'))
  const git = (/** @type {string[]} */ ...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' })
  try {
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 't@x.pl')
    git('config', 'user.name', 't')
    mkdirSync(join(repo, 'src'))
    writeFileSync(join(repo, 'src/stary.ts'), 'export const a = 1\n'.repeat(20))
    git('add', '-A')
    git('commit', '-qm', 'start')
    git('switch', '-qc', 'feature/x')
    git('mv', 'src/stary.ts', 'src/nowy.ts')
    mkdirSync(join(repo, 'docs'))
    writeFileSync(join(repo, 'docs/plan.md'), '# plan\n')
    writeFileSync(join(repo, 'src/b.ts'), 'export const b = 2\n')
    writeFileSync(join(repo, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0x0d, 0, 1, 2]))
    git('add', '-A')
    git('commit', '-qm', 'zmiany')
    const bez = JSON.parse(spawnSync(process.execPath, [CLI, '--projekt', repo], { encoding: 'utf8' }).stdout)
    assert.deepEqual({ ...bez, baza: '', czubek: '' }, { baza: '', czubek: '', wszystkie: 4, binarne: 1, odfiltrowane: 0, doRecenzji: 3, pliki: ['docs/plan.md', 'src/b.ts', 'src/nowy.ts'], filtry: 0 })
    writeFileSync(join(repo, '.coderabbit.yaml'), 'reviews:\n  path_filters:\n    - "!docs/**"\n')
    git('add', '-A')
    git('commit', '-qm', 'bot')
    const w = spawnSync(process.execPath, [CLI], { cwd: repo, encoding: 'utf8' })
    assert.equal(w.status, 0, w.stderr)
    assert.deepEqual({ ...JSON.parse(w.stdout), baza: '', czubek: '' }, { baza: '', czubek: '', wszystkie: 5, binarne: 1, odfiltrowane: 1, doRecenzji: 3, pliki: ['.coderabbit.yaml', 'src/b.ts', 'src/nowy.ts'], filtry: 1 })
    const zla = spawnSync(process.execPath, [CLI, '--projekt', repo, '--baza', 'nie-ma-takiego'], { encoding: 'utf8' })
    assert.equal(zla.status, 3)
    assert.match(JSON.parse(zla.stdout).wyjatek, /^git diff nie-ma-takiego HEAD:/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// P20 S2: czesc PR mierzona bez worktree (vibersi etap 3 — worktree na 909f669 + --projekt, potem git worktree remove).
test('--czubek: diff baza..czubek i filtry z .coderabbit.yaml w czubku (git show), nie z drzewa roboczego; zly czubek = wyjatek', () => {
  const repo = mkdtempSync(join(tmpdir(), 'rozmiar-czubek-'))
  const git = (/** @type {string[]} */ ...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' }).stdout.trim()
  /** @param {string[]} a */
  const cli = (...a) => spawnSync(process.execPath, [CLI, '--projekt', repo, ...a], { encoding: 'utf8' })
  try {
    git('init', '-q', '-b', 'main')
    git('config', 'user.email', 't@x.pl')
    git('config', 'user.name', 't')
    writeFileSync(join(repo, 'README.md'), '# x\n')
    git('add', '-A')
    git('commit', '-qm', 'start')
    git('switch', '-qc', 'feature/x')
    mkdirSync(join(repo, 'docs'))
    writeFileSync(join(repo, 'docs/a.md'), 'a\n')
    writeFileSync(join(repo, 'a.ts'), 'a\n')
    writeFileSync(join(repo, '.coderabbit.yaml'), 'reviews:\n  path_filters:\n    - "!docs/**"\n')
    git('add', '-A')
    git('commit', '-qm', 'faza 1')
    const faza1 = git('rev-parse', 'HEAD')
    writeFileSync(join(repo, 'b.ts'), 'b\n')
    writeFileSync(join(repo, 'docs/b.md'), 'b\n')
    writeFileSync(join(repo, '.coderabbit.yaml'), 'reviews:\n  path_filters:\n    - "!docs/**"\n    - "!*.ts"\n')
    git('add', '-A')
    git('commit', '-qm', 'faza 2')
    // Drzewo robocze bez filtrow — pomiar czubka go nie czyta.
    writeFileSync(join(repo, '.coderabbit.yaml'), 'reviews:\n  profile: chill\n')
    const czesc1 = JSON.parse(cli('--czubek', faza1).stdout)
    assert.deepEqual({ ...czesc1, baza: '' }, { baza: '', czubek: faza1, wszystkie: 3, binarne: 0, odfiltrowane: 1, doRecenzji: 2, pliki: ['.coderabbit.yaml', 'a.ts'], filtry: 1 })
    assert.equal(czesc1.baza, git('rev-parse', 'main'), 'baza domyslna = merge-base czubka z main')
    const czesc2 = JSON.parse(cli('--baza', faza1, '--czubek', 'HEAD').stdout)
    assert.deepEqual([czesc2.pliki, czesc2.filtry, czesc2.odfiltrowane], [['.coderabbit.yaml'], 2, 2], 'filtry z HEAD: !*.ts wyklucza b.ts')
    assert.equal(czesc2.czubek, git('rev-parse', 'HEAD'), 'czubek w wyniku jako SHA, nie ref')
    // Pomiar z galezi glownej, ktora poszla dalej: baza = merge-base czubka z main, nie HEAD.
    const rozwidlenie = git('rev-parse', 'main')
    git('checkout', '--', '.coderabbit.yaml')
    git('switch', '-q', 'main')
    assert.equal(git('branch', '--show-current'), 'main')
    writeFileSync(join(repo, 'c.ts'), 'c\n')
    git('add', 'c.ts')
    git('commit', '-qm', 'main dalej')
    assert.equal(JSON.parse(cli('--czubek', faza1).stdout).baza, rozwidlenie)
    const zly = cli('--czubek', 'nie-ma-takiego')
    assert.equal(zly.status, 3)
    assert.equal(JSON.parse(zly.stdout).wyjatek, 'nie ma commita nie-ma-takiego')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

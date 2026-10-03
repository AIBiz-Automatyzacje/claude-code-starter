// Test CLI bramek na projekcie-fixture: prawdziwy ESLint i tsc szablonu, migracje w gicie, atrapy knip/size-limit/Stryker/vitest
// z nagranym wyjsciem. Wynik JSON {bramka: {status, sekundy, trafienia}}; kod 1 przy porazce, 0 bez porazki, 2 przy zlych argumentach.

import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { FIXTURES, atrapa, commit, git, noweRepo, usun, zapisz } from './repo-testowe.mjs'

const CLI = resolve(FIXTURES, '..', '..', 'bramki.mjs')
const NODE_MODULES_SZABLONU = resolve(FIXTURES, '..', '..', '..', '..', '..', 'node_modules')
const BRAMKI = ['typecheck', 'eslint', 'testyTypow', 'knip', 'sizeLimit', 'migracje', 'migracjeSuma', 'advisors', 'testyUsuniete', 'stryker']
const MIGRACJA = 'supabase/migrations/20260901000000_oferty.sql'
const KOD = 'export function wczytaj(tekst: string): unknown {\n  try {\n    return JSON.parse(tekst)\n  } catch (e) {\n    throw new Error(\'zly JSON\', { cause: e })\n  }\n}\n'

/** @param {string[]} argumenty @param {NodeJS.ProcessEnv} [env] */
function cli(argumenty, env = { PATH: `${dirname(process.execPath)}:/usr/bin:/bin` }) {
  const p = spawnSync(process.execPath, [CLI, ...argumenty], { encoding: 'utf8', env })
  return { kod: p.status, wynik: p.stdout ? JSON.parse(p.stdout) : null, stderr: p.stderr }
}

/** @returns {{ repo: string, baza: string }} projekt z narzedziami: ESLint i tsc prawdziwe, reszta atrapy */
function projekt() {
  const repo = noweRepo()
  zapisz(repo, {
    '.gitignore': 'node_modules\nreports\n',
    'eslint.config.js': "import js from '@eslint/js'\nexport default [{ files: ['**/*.js'], ...js.configs.recommended }]\n",
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'es2023', module: 'nodenext', types: [] }, include: ['src'] }),
    'knip.json': '{}\n',
    '.size-limit.json': '[]\n',
    'stryker.config.json': '{}\n',
    [MIGRACJA]: 'create table oferty (id int);\n',
    'src/stary.ts': 'export const stary = 1\n',
  })
  // node_modules projektu: @eslint/js szablonu, eslint i tsc przez skrypt exec (shim pnpm liczy sciezki od $0, dowiazanie by go zepsulo)
  mkdirSync(join(repo, 'node_modules', '@eslint'), { recursive: true })
  symlinkSync(join(NODE_MODULES_SZABLONU, '@eslint', 'js'), join(repo, 'node_modules', '@eslint', 'js'))
  mkdirSync(join(repo, 'node_modules', '.bin'))
  for (const bin of ['eslint', 'tsc']) {
    writeFileSync(join(repo, 'node_modules', '.bin', bin), `#!/bin/sh\nexec "${join(NODE_MODULES_SZABLONU, '.bin', bin)}" "$@"\n`)
    chmodSync(join(repo, 'node_modules', '.bin', bin), 0o755)
  }
  atrapa(repo, { nazwa: 'knip', znacznik: 'src/stary.ts', wzorzec: 'nieuzywana', naruszenie: 'knip-naruszenie.json', czyste: 'knip-czyste.json' })
  atrapa(repo, { nazwa: 'size-limit', znacznik: 'src/stary.ts', wzorzec: 'duzy', naruszenie: 'size-limit-naruszenie.json', czyste: 'size-limit-czyste.json' })
  atrapa(repo, { nazwa: 'vitest', znacznik: 'src/stary.ts', wzorzec: 'zly-typ', naruszenie: 'vitest-typecheck-naruszenie.json', czyste: 'vitest-typecheck-czyste.json' })
  atrapa(repo, { nazwa: 'stryker', znacznik: 'src/stary.ts', wzorzec: 'slaby', naruszenie: 'stryker-przezyte.json', czyste: 'stryker-czyste.json', kodNaruszenia: 0, plikWyjscia: 'reports/mutation/mutation.json' })
  return { repo, baza: commit(repo, 'baza') }
}

test('faza czysta: kod 0, kazda bramka z polami status, sekundy, trafienia; nieobecne dane = brak/pominieta', () => {
  const { repo, baza } = projekt()
  try {
    zapisz(repo, { 'src/json.ts': KOD })
    const { kod, wynik, stderr } = cli(['--baza', baza, '--projekt', repo])
    assert.equal(kod, 0, stderr)
    assert.deepEqual(Object.keys(wynik), BRAMKI)
    for (const b of BRAMKI) {
      assert.deepEqual(Object.keys(wynik[b]).slice(0, 3), ['status', 'sekundy', 'trafienia'], b)
      assert.equal(typeof wynik[b].sekundy, 'number', b)
    }
    assert.deepEqual(BRAMKI.map((b) => [b, wynik[b].status]), [
      ['typecheck', 'ok'], ['eslint', 'ok'], ['testyTypow', 'pominieta'], ['knip', 'ok'], ['sizeLimit', 'ok'], ['migracje', 'ok'],
      ['migracjeSuma', 'brak'], ['advisors', 'brak'], ['testyUsuniete', 'ok'], ['stryker', 'pominieta'],
    ])
  } finally {
    usun(repo)
  }
})

test('defekty mechaniczne: blad typu i edycja migracji z bazy -> kod 1, porazki z konkretna regula', () => {
  const { repo, baza } = projekt()
  try {
    zapisz(repo, { 'src/json.ts': KOD.replace(': unknown', ': string').replace('JSON.parse(tekst)', '1'), [MIGRACJA]: 'create table oferty (id bigint);\n' })
    const { kod, wynik } = cli(['--baza', baza, '--projekt', repo])
    assert.equal(kod, 1)
    assert.deepEqual(wynik.typecheck.trafienia.map((/** @type {{ regula: string }} */ t) => t.regula), ['TS2322'])
    assert.deepEqual(wynik.migracje.trafienia.map((/** @type {{ plik: string }} */ t) => t.plik), [MIGRACJA])
  } finally {
    usun(repo)
  }
})

test('projekt bez narzedzi: wszystkie bramki narzedziowe = brak z powodem, kod 0', () => {
  const repo = noweRepo()
  try {
    const baza = git(repo, ['rev-parse', 'HEAD'])
    zapisz(repo, { 'src/a.ts': 'export const a = 1\n' })
    const { kod, wynik } = cli(['--baza', baza, '--projekt', repo])
    assert.equal(kod, 0)
    for (const b of ['typecheck', 'eslint', 'testyTypow', 'knip', 'sizeLimit', 'stryker']) {
      assert.equal(wynik[b].status, 'brak', b)
      assert.match(wynik[b].powod, /node_modules\/\.bin/, b)
    }
  } finally {
    usun(repo)
  }
})

test('--dopisz-sume tworzy supabase/migrations.sum; potem bramka migracjeSuma = ok', () => {
  const { repo, baza } = projekt()
  try {
    const dopisz = cli(['--dopisz-sume', '--projekt', repo])
    assert.equal(dopisz.kod, 0)
    assert.deepEqual(dopisz.wynik, { dopisane: ['20260901000000_oferty.sql'] })
    assert.match(readFileSync(join(repo, 'supabase', 'migrations.sum'), 'utf8'), /^[0-9a-f]{64} {2}20260901000000_oferty\.sql\n$/)
    assert.equal(cli(['--baza', baza, '--projekt', repo]).wynik.migracjeSuma.status, 'ok')
  } finally {
    usun(repo)
  }
})

test('zle argumenty: brak --baza albo baza spoza repo = kod 2 z komunikatem na stderr', () => {
  const repo = noweRepo()
  try {
    const bezBazy = cli(['--projekt', repo])
    assert.equal(bezBazy.kod, 2)
    assert.match(bezBazy.stderr, /--baza/)
    const zlaBaza = cli(['--baza', 'nie-ma-takiej', '--projekt', repo])
    assert.equal(zlaBaza.kod, 2)
    assert.match(zlaBaza.stderr, /nie-ma-takiej/)
  } finally {
    usun(repo)
  }
})

// Pakiet fixture smoke'a z bramkami (PLAN-POPRAWY P6): pliki pakietu + konfiguracje z .claude/templates/bramki
// + devDependencies bramek, zeby smoke uruchamial prawdziwe bramki domkniecia, a nie same `brak`.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const SMOKE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BRAMKI = resolve(SMOKE, '..', 'bramki')

test('wstaw-pakiet: pliki pakietu, konfiguracje bramek (szablon ESLint jako eslint.config.ts) i devDependencies bramek', () => {
  const pakiet = join(mkdtempSync(join(tmpdir(), 'smoke-pakiet-')), 'packages', 'smoke-autopilot')
  try {
    execFileSync(process.execPath, [join(SMOKE, 'wstaw-pakiet.mjs'), pakiet])
    for (const plik of ['package.json', 'tsconfig.json', 'vitest.config.ts', 'eslint.config.ts', 'knip.json', '.size-limit.json', 'stryker.config.json']) {
      assert.ok(existsSync(join(pakiet, plik)), plik)
    }
    assert.equal(readFileSync(join(pakiet, 'eslint.config.ts'), 'utf8'), readFileSync(join(BRAMKI, 'eslint.config.szablon.ts'), 'utf8'))
    const json = JSON.parse(readFileSync(join(pakiet, 'package.json'), 'utf8'))
    assert.deepEqual(json.devDependencies, JSON.parse(readFileSync(join(BRAMKI, 'package.json'), 'utf8')).devDependencies)
    assert.deepEqual(Object.keys(json.scripts).sort(), ['build', 'test', 'typecheck'])
  } finally {
    rmSync(dirname(dirname(pakiet)), { recursive: true, force: true })
  }
})

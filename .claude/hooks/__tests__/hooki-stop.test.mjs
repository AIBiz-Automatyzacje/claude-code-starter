// Hooki Stop (PLAN-POPRAWY P6): error-handling-reminder.sh konczy sie od razu w projekcie z konfiguracja ESLint
// z szablonu (no-console, no-empty i no-floating-promises przejmuja jego prace), a dziala dalej w projektach bez niej.
// Oba hooki Stop wychodza od razu przy stop_hook_active: true — Claude kontynuuje juz po blokadzie hooka Stop, druga
// blokada w tej samej turze to petla (dokumentacja hookow Claude Code).

import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HOOKI = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BLOKADA = 2
const WEJSCIE = (/** @type {boolean} */ aktywny) => JSON.stringify({ session_id: 's', hook_event_name: 'Stop', stop_hook_active: aktywny })

/**
 * @param {string} hook
 * @param {Record<string, string>} pliki
 * @param {string} wejscie stdin hooka
 * @param {NodeJS.ProcessEnv} [env]
 */
function uruchom(hook, pliki, wejscie, env = {}) {
  const projekt = mkdtempSync(join(tmpdir(), 'hook-stop-'))
  try {
    execFileSync('git', ['-C', projekt, 'init', '-q'])
    for (const [sciezka, tresc] of Object.entries(pliki)) {
      mkdirSync(dirname(join(projekt, sciezka)), { recursive: true })
      writeFileSync(join(projekt, sciezka), tresc)
    }
    const wynik = spawnSync('bash', [join(HOOKI, hook)], { encoding: 'utf8', input: wejscie, env: { ...process.env, ...env, CLAUDE_PROJECT_DIR: projekt } })
    return { ...wynik, projekt }
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

const CONSOLE_W_SRC = { 'src/app.ts': "export const x = 1\nconsole.log('start')\n" }

test('error-handling: console.log w src bez konfiguracji ESLint z szablonu = blokada (starsze projekty)', () => {
  const w = uruchom('error-handling-reminder.sh', { ...CONSOLE_W_SRC, 'eslint.config.js': 'export default []\n' }, WEJSCIE(false))
  assert.equal(w.status, BLOKADA, w.stderr)
  assert.match(w.stderr, /src\/app\.ts/)
})

test('error-handling: eslint.config.ts z szablonu (znacznik .claude/templates/bramki) = koniec od razu', () => {
  const konfiguracja = '// Konfiguracja ESLint z szablonu (.claude/templates/bramki) — w projekcie kopiuj jako eslint.config.ts\nexport default []\n'
  const w = uruchom('error-handling-reminder.sh', { ...CONSOLE_W_SRC, 'eslint.config.ts': konfiguracja }, WEJSCIE(false))
  assert.equal(w.status, 0, w.stderr)
  assert.equal(w.stderr, '')
})

test('error-handling: stop_hook_active = koniec od razu mimo ostrzezen', () => {
  const w = uruchom('error-handling-reminder.sh', CONSOLE_W_SRC, WEJSCIE(true))
  assert.equal(w.status, 0, w.stderr)
})

/** Atrapa npx w PATH: zapisuje znacznik wywolania — sprawdza, czy hook doszedl do tsc. */
function atrapaNpx() {
  const bin = mkdtempSync(join(tmpdir(), 'hook-npx-'))
  const znacznik = join(bin, 'wywolano')
  writeFileSync(join(bin, 'npx'), `#!/bin/sh\ntouch "${znacznik}"\n`)
  chmodSync(join(bin, 'npx'), 0o755)
  return { bin, znacznik }
}

const PROJEKT_TS = { 'tsconfig.json': '{}', 'node_modules/typescript/package.json': '{}' }

test('stop-build-check: stop_hook_active = koniec przed tsc; bez niego tsc biegnie', () => {
  const npx = atrapaNpx()
  try {
    const env = { PATH: `${npx.bin}:${process.env.PATH}` }
    const aktywny = uruchom('stop-build-check-enhanced.sh', PROJEKT_TS, WEJSCIE(true), env)
    assert.equal(aktywny.status, 0, aktywny.stderr)
    assert.equal(existsSync(npx.znacznik), false)

    const zwykly = uruchom('stop-build-check-enhanced.sh', PROJEKT_TS, WEJSCIE(false), env)
    assert.equal(zwykly.status, 0, zwykly.stderr)
    assert.equal(existsSync(npx.znacznik), true)
  } finally {
    rmSync(npx.bin, { recursive: true, force: true })
  }
})

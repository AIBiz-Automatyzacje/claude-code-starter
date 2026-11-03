// Hook Stop error-handling-reminder.sh w stacku web (plan szablonu mobile z rdzenia, IU-1.7): pliki frontendu hook
// rozpoznaje globem `zrodla.frontend` z `.claude/stack/profil.json` — w webie `src/`. Kontrakt wspólny (Edge Functions)
// sprawdza `.claude/hooks/__tests__/error-handling-reminder.test.mjs`.
//
// Uruchomienie: node --test stacks/web/__tests__/hooki.test.mjs

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.claude/hooks/error-handling-reminder.sh')

/** @param {Record<string, string>} pliki ścieżka względem projektu → treść */
function uruchomHook(pliki) {
  const projekt = mkdtempSync(join(tmpdir(), 'hook-web-'))
  try {
    execFileSync('git', ['-C', projekt, 'init', '-q'])
    for (const [plik, tresc] of Object.entries(pliki)) {
      mkdirSync(dirname(join(projekt, plik)), { recursive: true })
      writeFileSync(join(projekt, plik), tresc)
    }
    return spawnSync('bash', [HOOK], { encoding: 'utf8', input: '{}', env: { ...process.env, CLAUDE_PROJECT_DIR: projekt } })
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

test('console.log w src/ daje ostrzeżenie z linią (exit 2)', () => {
  const wynik = uruchomHook({ 'src/lib/zapis.ts': 'export const f = () => {\n  console.log("x")\n}\n' })
  assert.equal(wynik.status, 2, wynik.stderr)
  assert.match(wynik.stderr, /src\/lib\/zapis\.ts\n\s+Linia 2: console\.log\(/)
})

test('console.log poza src/ i w konfiguracji Vite/Tailwind nie jest sprawdzany', () => {
  const wynik = uruchomHook({
    'scripts/narzedzie.ts': 'console.log("x")\n',
    'vite.config.ts': 'console.log("x")\n',
    'src/tailwind.config.ts': 'console.log("x")\n',
  })
  assert.equal(wynik.status, 0, wynik.stderr)
})

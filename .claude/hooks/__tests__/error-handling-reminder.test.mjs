// Hook Stop error-handling-reminder.sh na Edge Functions (P1, prompt-audit PA-18: H26, H27).
// Po co: skill supabase-dev-guidelines pisze handler przez withSupabase, a hook szukal tylko Deno.serve —
// nowe funkcje wypadaly z kontroli. captureError z sentry-integration flushuje sam, wiec wymagane jest
// jego await, nie osobne flush().

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'error-handling-reminder.sh')

/** @param {string} tresc */
function uruchomHook(tresc) {
  const projekt = mkdtempSync(join(tmpdir(), 'hook-eh-'))
  try {
    execFileSync('git', ['-C', projekt, 'init', '-q'])
    mkdirSync(join(projekt, 'supabase', 'functions', 'oferta'), { recursive: true })
    writeFileSync(join(projekt, 'supabase', 'functions', 'oferta', 'index.ts'), tresc)
    return spawnSync('bash', [HOOK], { encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: projekt } })
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

/** @param {string} wywolanie */
const HANDLER_WITH_SUPABASE = (wywolanie) => `import { withSupabase } from '../_shared/supabase.ts'
import { captureError } from '../_shared/sentry.ts'

export default withSupabase(async (req, ctx) => {
  try {
    return new Response('ok')
  } catch (error) {
    ${wywolanie}
    return new Response('blad', { status: 500 })
  }
})
`

test('withSupabase: captureError bez await daje ostrzezenie (exit 2)', () => {
  const wynik = uruchomHook(HANDLER_WITH_SUPABASE('captureError(error, { req })'))
  assert.equal(wynik.status, 2, wynik.stderr)
  assert.match(wynik.stderr, /supabase\/functions\/oferta\/index\.ts/)
  assert.match(wynik.stderr, /captureError\(\) bez await/)
})

test('withSupabase: await captureError bez osobnego flush() przechodzi (exit 0)', () => {
  const wynik = uruchomHook(HANDLER_WITH_SUPABASE('await captureError(error, { req })'))
  assert.equal(wynik.status, 0, wynik.stderr)
})

test('Deno.serve: await captureError bez osobnego flush() przechodzi (exit 0)', () => {
  const tresc = HANDLER_WITH_SUPABASE('await captureError(error, { req })')
    .replace("import { withSupabase } from '../_shared/supabase.ts'\n", '')
    .replace('export default withSupabase(async (req, ctx) => {', 'Deno.serve(async (req) => {')
  const wynik = uruchomHook(tresc)
  assert.equal(wynik.status, 0, wynik.stderr)
})

test('Deno.serve: brak captureError w catch nadal daje ostrzezenie', () => {
  const tresc = HANDLER_WITH_SUPABASE('void error')
    .replace("import { withSupabase } from '../_shared/supabase.ts'\n", '')
    .replace('export default withSupabase(async (req, ctx) => {', 'Deno.serve(async (req) => {')
  const wynik = uruchomHook(tresc)
  assert.equal(wynik.status, 2, wynik.stderr)
  assert.match(wynik.stderr, /Brak captureError\(\)/)
})

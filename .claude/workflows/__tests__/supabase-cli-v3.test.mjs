// Supabase CLI 3.0.0 (2026-11-02): każda zmiana hostowanej bazy bez terminala (agent, CI) wymaga `--yes`, inaczej
// HostedMutationConsentRequiredError; potok `echo Y |` już nic nie potwierdza. `--yes` jest flagą globalną także w v2,
// a `--db-url` działa w obu wersjach (w v3 deprecated z ostrzeżeniem, usunięte w v4) — więc `--db-url … --yes` to
// jedyna forma zgodna z v2 i v3. Bare `db push`/`migration list` w v3 celuje w lokalny stack: na zdalną bazę `--linked`.
// Źródło: https://supabase.com/docs/guides/local-development/cli/migrating-to-v3
//
// Uruchomienie: node --test .claude/workflows/__tests__/supabase-cli-v3.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
/** @param {string} sciezka */
const czytaj = (sciezka) => readFileSync(resolve(KATALOG, '..', '..', sciezka), 'utf8')

const autopilot = czytaj('workflows/dev-autopilot-wf.js')
const e2eEnv = czytaj('templates/e2e-env/README.md')
const smokeAutopilot = czytaj('templates/smoke-autopilot/README.md')
const cliGuide = czytaj('skills/supabase-dev-guidelines/resources/cli-guide.md')

/**
 * Wywołania `supabase db push` z `--db-url` bez `--yes` w tej samej komendzie (do końca backticka).
 * @param {string} tekst
 */
function pushyBezYes(tekst) {
  return [...tekst.matchAll(/supabase db push[^`\n]*--db-url[^`\n]*/g)].map((m) => m[0]).filter((k) => !/--yes\b/.test(k))
}

test('db-sync autopilota pcha migracje na bazę e2e z --yes, bez potoku echo Y', () => {
  assert.match(autopilot, /supabase db push --db-url "\$SUPABASE_E2E_DB_URL" --include-all --yes/)
  assert.doesNotMatch(autopilot, /echo Y \|/, 'v3 nie czyta odpowiedzi z potoku')
  assert.deepEqual(pushyBezYes(autopilot), [])
})

test('szablony e2e-env i smoke-autopilot podają db push z --yes', () => {
  assert.deepEqual(pushyBezYes(e2eEnv), [])
  assert.deepEqual(pushyBezYes(smokeAutopilot), [])
})

test('cli-guide opisuje różnice v3: lokalny cel domyślny, --linked na zdalną bazę, --yes bez terminala', () => {
  assert.match(cliGuide, /CLI 3/)
  assert.match(cliGuide, /supabase db push --linked/)
  assert.match(cliGuide, /--yes/)
  assert.doesNotMatch(cliGuide, /^supabase db push\s+# Wypchnij migracje na remote/m, 'bare db push w v3 idzie na lokalny stack')
})

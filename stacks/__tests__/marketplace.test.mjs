// Marketplace w korzeniu repo szablonu (decyzja operatora 2026-11-08, zamiast marketplace'u typu `settings` z IU-3.4b): przypina
// plugin expo na jednym commicie expo/skills. Wariant Expo deklaruje go w settings.patch.json jako źródło `github`, więc doctor
// podaje `claude plugin marketplace add` i instalacja nie zależy od okna zaufania folderu.
//
// Uruchomienie: node --test stacks/__tests__/marketplace.test.mjs

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const czytajJson = (/** @type {string} */ sciezka) => JSON.parse(readFileSync(resolve(KORZEN, sciezka), 'utf8'))
const marketplace = czytajJson('.claude-plugin/marketplace.json')
const patch = czytajJson('stacks/expo/settings.patch.json')

test('marketplace: jeden plugin expo z expo/skills plugins/expo na pełnym SHA', () => {
  assert.equal(marketplace.name, 'claude-code-starter')
  assert.equal(marketplace.owner.name, 'AIBiz-Automatyzacje')
  assert.equal(marketplace.plugins.length, 1)
  const [expo] = marketplace.plugins
  assert.equal(expo.name, 'expo', 'nazwa wpisu = nazwa z plugin.json, inaczej skille nie mają prefiksu expo:')
  assert.deepEqual(Object.keys(expo.source).sort(), ['path', 'ref', 'sha', 'source', 'url'])
  assert.equal(expo.source.source, 'git-subdir')
  assert.equal(expo.source.url, 'https://github.com/expo/skills.git')
  assert.equal(expo.source.path, 'plugins/expo')
  assert.match(expo.source.sha, /^[0-9a-f]{40}$/)
})

test('wariant Expo: marketplace z repo szablonu pod nazwą z pliku i plugin expo z niego, bez autoUpdate', () => {
  const wpis = patch.extraKnownMarketplaces[marketplace.name]
  assert.deepEqual(wpis, { source: { source: 'github', repo: 'AIBiz-Automatyzacje/claude-code-starter' } })
  assert.equal(patch.enabledPlugins[`expo@${marketplace.name}`], true)
})

const claude = spawnSync('claude', ['--version'], { encoding: 'utf8' })
test('claude plugin validate przyjmuje marketplace', { skip: claude.error || claude.status !== 0 ? 'brak claude CLI' : false }, () => {
  const w = spawnSync('claude', ['plugin', 'validate', KORZEN], { encoding: 'utf8', timeout: 60000 })
  assert.equal(w.status, 0, `${w.stdout}${w.stderr}`)
  assert.match(w.stdout, /Validation passed/)
})

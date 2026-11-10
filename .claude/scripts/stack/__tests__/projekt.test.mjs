// Sygnaly technologii projektu (znaleziska 2026-11-02 pkt 26 i 31): jedno zrodlo dla walidacji planu i doctora. Dashboard
// ma klienta w frontend/ i backend w Pythonie, wiec manifest pakietu pierwszego poziomu liczy sie jak manifest korzenia.
//
// Uruchomienie: node --test .claude/scripts/stack/__tests__/projekt.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { manifesty, manifestyZZaleznoscia, uzywaSupabase } from '../projekt.mjs'

/** @param {Record<string, string>} pliki @param {(projekt: string) => void} cialo */
function zProjektem(pliki, cialo) {
  const projekt = mkdtempSync(join(tmpdir(), 'sygnaly-'))
  try {
    for (const [sciezka, tresc] of Object.entries(pliki)) {
      mkdirSync(dirname(join(projekt, sciezka)), { recursive: true })
      writeFileSync(join(projekt, sciezka), tresc)
    }
    cialo(projekt)
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

const pakiet = (/** @type {Record<string, unknown>} */ dane) => JSON.stringify(dane)

test('manifesty: korzen i katalogi pierwszego poziomu, bez ukrytych, node_modules i glebszych', () => zProjektem({
  'package.json': '{}',
  'frontend/package.json': '{}',
  'backend/pyproject.toml': '',
  'apps/web/package.json': '{}',
  '.claude/package.json': '{}',
  'node_modules/package.json': '{}',
}, (projekt) => {
  assert.deepEqual(manifesty(projekt), ['package.json', 'frontend/package.json'])
  assert.deepEqual(manifesty(join(projekt, 'brak')), [])
}))

test('manifestyZZaleznoscia: paczka w dowolnym polu zaleznosci; skrypt o tej nazwie i zepsuty JSON to nie sygnal', () => zProjektem({
  'package.json': pakiet({ scripts: { expo: 'echo' }, dependencies: { react: '19.2.0' } }),
  'mobile/package.json': pakiet({ devDependencies: { expo: '58.0.0' } }),
  'zepsuty/package.json': '{ "dependencies": { "expo": ',
}, (projekt) => {
  assert.deepEqual(manifestyZZaleznoscia(projekt, 'expo'), ['mobile/package.json'])
  assert.deepEqual(manifestyZZaleznoscia(projekt, 'react'), ['package.json'])
  assert.deepEqual(manifestyZZaleznoscia(projekt, 'left-pad'), [])
}))

test('uzywaSupabase: katalog supabase/ albo klient w manifescie; inna paczka @supabase i projekt bez manifestu — nie', () => {
  zProjektem({}, (projekt) => assert.equal(uzywaSupabase(projekt), false))
  zProjektem({ 'supabase/config.toml': '' }, (projekt) => assert.equal(uzywaSupabase(projekt), true))
  zProjektem({ 'frontend/package.json': pakiet({ dependencies: { '@supabase/supabase-js': '2.50.0' } }) }, (projekt) => assert.equal(uzywaSupabase(projekt), true))
  zProjektem({ 'package.json': pakiet({ dependencies: { '@supabase/ssr': '0.6.1' } }) }, (projekt) => assert.equal(uzywaSupabase(projekt), false))
})

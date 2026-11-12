// Sygnaly technologii projektu (znaleziska 2026-11-02 pkt 26 i 31): jedno zrodlo dla walidacji planu i doctora. Dashboard
// ma klienta w frontend/ i backend w Pythonie, wiec manifest pakietu pierwszego poziomu liczy sie jak manifest korzenia.
//
// Uruchomienie: node --test .claude/scripts/stack/__tests__/projekt.test.mjs

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { manifesty, manifestyZZaleznoscia, stanSupabase, sygnalSupabase, uzywaSupabase } from '../projekt.mjs'

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

// Weryfikacja partii 26–45, punkt 55 (26): „Supabase — nie dotyczy” takze przy Supabase w apps/web/, w requirements.txt, przy samym
// @supabase/ssr i przy zepsutym package.json. Sygnal ma trzy wartosci; uzywaSupabase = wszystko poza pewnym „nie”.
test('sygnalSupabase: katalog, config.toml do 3 poziomow, dowolna paczka @supabase/*, Python; zepsuty manifest = nieznane', () => {
  zProjektem({}, (projekt) => assert.deepEqual([sygnalSupabase(projekt), uzywaSupabase(projekt)], ['nie', false]))
  zProjektem({ 'supabase/config.toml': '' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak'))
  zProjektem({ 'apps/web/supabase/config.toml': '' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak'))
  zProjektem({ 'a/b/c/supabase/config.toml': '' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'nie', 'ponad 3 poziomy'))
  zProjektem({ 'node_modules/x/supabase/config.toml': '', '.git/supabase/config.toml': '' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'nie', 'ukryte i node_modules pominiete'))
  zProjektem({ 'frontend/package.json': pakiet({ dependencies: { '@supabase/supabase-js': '2.50.0' } }) }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak'))
  zProjektem({ 'package.json': pakiet({ dependencies: { '@supabase/ssr': '0.6.1' } }) }, (projekt) => assert.equal(uzywaSupabase(projekt), true))
  zProjektem({ 'apps/web/package.json': pakiet({ devDependencies: { '@supabase/ssr': '0.6.1' } }) }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak'))
  zProjektem({ 'requirements.txt': 'fastapi==0.115\nsupabase>=2.0\n' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak'))
  zProjektem({ 'backend/pyproject.toml': '[project]\ndependencies = [\n  "supabase>=2.0",\n]\n' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak'))
  zProjektem({ 'requirements.txt': 'supabase-auth-helpers-niezwiazane\n# supabase w komentarzu\n' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'nie'))
  // Walidacja 51–55, punkty 58 i 60: lista zaleznosci w jednej linii; negatywy, ktorych dotad nie bylo.
  zProjektem({ 'backend/pyproject.toml': '[project]\ndependencies = ["fastapi>=0.110", "supabase>=2.4"]\n' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak', 'lista w jednej linii'))
  zProjektem({ 'pyproject.toml': '[tool.poetry.dependencies]\nsupabase = "^2.4"\n' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak', 'klucz tabeli poetry'))
  zProjektem({ 'pyproject.toml': '# dependencies = ["supabase"]\ndependencies = ["supabase-niezwiazane", "fastapi"]\n' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'nie', 'komentarz i inna paczka'))
  zProjektem({ 'a/b/requirements.txt': 'supabase>=2.0\n' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'nie', 'Python tylko w korzeniu i na pierwszym poziomie'))
  zProjektem({ 'apps/web/config.toml': '' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'nie', 'config.toml poza katalogiem supabase'))
  zProjektem({ 'dist/supabase/config.toml': '', 'apps/build/supabase/config.toml': '' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'nie', 'dist i build pominiete'))
  zProjektem({ 'supabase/migrations/1.sql': '' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak', 'sam katalog supabase/ w korzeniu'))
  zProjektem({ 'package.json': '{', 'requirements.txt': 'supabase\n' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak', 'Python wygrywa z nieczytelnym manifestem'))
  zProjektem({ 'package.json': '{ "dependencies": ', 'frontend/package.json': pakiet({ dependencies: { react: '19.2.0' } }) }, (projekt) => {
    assert.deepEqual(stanSupabase(projekt), { sygnal: 'nieznane', nieczytelne: ['package.json'] })
    assert.equal(uzywaSupabase(projekt), true, 'nieznane to nie „nie”')
  })
  zProjektem({ 'zepsuty/package.json': '{', 'supabase/config.toml': '' }, (projekt) => assert.equal(sygnalSupabase(projekt), 'tak', 'trafienie wygrywa z nieczytelnym'))
})

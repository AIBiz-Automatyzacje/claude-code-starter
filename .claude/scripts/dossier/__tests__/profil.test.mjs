// Profil stacku do dossier: znane paczki z package.json (z wersja), Supabase z katalogu, TypeScript, uklad repo.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { profilStacku } from '../profil.mjs'

/** @param {Record<string, string>} pliki @returns {string} */
function projekt(pliki) {
  const katalog = mkdtempSync(join(tmpdir(), 'profil-'))
  for (const [sciezka, tresc] of Object.entries(pliki)) {
    mkdirSync(dirname(join(katalog, sciezka)), { recursive: true })
    writeFileSync(join(katalog, sciezka), tresc)
  }
  return katalog
}

const PACKAGE = JSON.stringify({
  dependencies: { react: '^19.1.0', '@supabase/supabase-js': '2.50.0', 'left-pad': '1.0.0' },
  devDependencies: { vite: '7.0.0', vitest: '4.1.11', typescript: '5.9.3' },
})

test('profil z supabase/: znane paczki z wersja (bez nieznanych), migracje i Edge Functions, TypeScript', () => {
  const katalog = projekt({
    'package.json': PACKAGE,
    'tsconfig.json': '{}',
    'supabase/migrations/001_a.sql': '',
    'supabase/migrations/002_b.sql': '',
    'supabase/functions/wyslij/index.ts': '',
  })
  try {
    const profil = profilStacku(katalog)
    assert.match(profil, /react \^19\.1\.0/)
    assert.match(profil, /@supabase\/supabase-js 2\.50\.0/)
    assert.match(profil, /vitest 4\.1\.11/)
    assert.doesNotMatch(profil, /left-pad/)
    assert.match(profil, /Supabase: katalog supabase\/ \(migracje: 2, Edge Functions: 1\)/)
    assert.match(profil, /TypeScript: tsconfig\.json/)
    assert.match(profil, /Uklad: jeden pakiet/)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

test('profil bez supabase/ i bez tsconfig; monorepo z pnpm-workspace.yaml; brak package.json nazwany wprost', () => {
  const katalog = projekt({ 'package.json': PACKAGE, 'pnpm-workspace.yaml': 'packages:\n  - apps/*\n', 'apps/web/package.json': '{}' })
  try {
    const profil = profilStacku(katalog)
    assert.match(profil, /Supabase: brak katalogu supabase\//)
    assert.match(profil, /TypeScript: brak tsconfig\.json/)
    assert.match(profil, /Uklad: monorepo \(pnpm-workspace\.yaml; apps\/\)/)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
  const pusty = projekt({ 'README.md': '' })
  try {
    assert.match(profilStacku(pusty), /Paczki: brak package\.json/)
  } finally {
    rmSync(pusty, { recursive: true, force: true })
  }
})

// Komendy-listy reviewerow per technologia maja warunek w profilu stacku (PLAN-POPRAWY P11). W monorepo framework siedzi
// w package.json pakietu (apps/web), nie w korzeniu — bez tych linii warunki „React w profilu” bylyby falszywe.
test('profil monorepo: znane paczki kazdego pakietu workspace z katalogow apps/ i packages/; pakiet bez znanych pominiety', () => {
  const katalog = projekt({
    'package.json': JSON.stringify({ devDependencies: { typescript: '5.9.3' } }),
    'pnpm-workspace.yaml': 'packages:\n  - apps/*\n  - packages/*\n',
    'apps/web/package.json': JSON.stringify({ dependencies: { react: '19.2.0' }, devDependencies: { vite: '7.0.0', 'babel-plugin-react-compiler': '1.0.0' } }),
    'apps/api/package.json': JSON.stringify({ dependencies: { hono: '4.9.0', zod: '4.4.3' } }),
    'packages/narzedzia/package.json': JSON.stringify({ dependencies: { 'left-pad': '1.0.0' } }),
  })
  try {
    const profil = profilStacku(katalog)
    assert.match(profil, /^- Paczki: typescript 5\.9\.3$/m)
    assert.match(profil, /^- Paczki apps\/api: hono 4\.9\.0, zod 4\.4\.3$/m)
    assert.match(profil, /^- Paczki apps\/web: react 19\.2\.0, vite 7\.0\.0, babel-plugin-react-compiler 1\.0\.0$/m)
    assert.doesNotMatch(profil, /packages\/narzedzia/)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

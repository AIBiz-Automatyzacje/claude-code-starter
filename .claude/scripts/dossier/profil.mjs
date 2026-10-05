// Profil stacku projektu do dossier: reviewer wie od razu, z jakimi bibliotekami i warstwami ma do czynienia,
// zamiast ustalac to wlasnym Read package.json i katalogow.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Paczki, ktore zmieniaja to, czego reviewer szuka (framework, dane, walidacja, testy, typy). Kolejnosc = kolejnosc w profilu.
// Pozycje list reviewerow per technologia maja warunek na tej liscie (np. React Compiler zmienia, czy brak memoizacji to finding).
const ZNANE_PACZKI = [
  'react', 'next', 'vite', 'expo', 'react-native', 'vue', 'svelte', '@sveltejs/kit', 'astro', 'babel-plugin-react-compiler',
  'express', 'fastify', 'hono', '@supabase/supabase-js', 'prisma', 'drizzle-orm', 'zod', '@tanstack/react-query',
  'tailwindcss', 'vitest', 'jest', '@playwright/test', 'typescript', 'eslint',
]
const KATALOGI_MONOREPO = ['apps', 'packages']

/** @param {string} katalog @returns {string[]} */
function wpisy(katalog) {
  return existsSync(katalog) ? readdirSync(katalog) : []
}

/**
 * @param {string} plik package.json
 * @returns {string[] | string} znane paczki z wersja albo powod, ze pliku nie da sie odczytac
 */
function znanePaczki(plik) {
  /** @type {{ dependencies?: Record<string, string>, devDependencies?: Record<string, string> }} */
  let pkg
  try {
    pkg = JSON.parse(readFileSync(plik, 'utf8'))
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e
    return `package.json nie parsuje sie (${e.message})`
  }
  const wersje = { ...pkg.devDependencies, ...pkg.dependencies }
  return ZNANE_PACZKI.filter((p) => p in wersje).map((p) => `${p} ${wersje[p]}`)
}

/** @param {string} projekt @returns {string} */
function paczki(projekt) {
  const plik = join(projekt, 'package.json')
  if (!existsSync(plik)) return 'Paczki: brak package.json'
  const znalezione = znanePaczki(plik)
  if (typeof znalezione === 'string') return `Paczki: ${znalezione}`
  return `Paczki: ${znalezione.join(', ') || 'zadna ze znanych (framework, dane, testy)'}`
}

/**
 * W monorepo framework siedzi w package.json pakietu, nie w korzeniu. Pakiet bez znanych paczek nie dostaje linii.
 * @param {string} projekt
 * @returns {string[]}
 */
function paczkiPakietow(projekt) {
  return KATALOGI_MONOREPO.flatMap((k) => wpisy(join(projekt, k)).sort().map((n) => `${k}/${n}`))
    .filter((pakiet) => existsSync(join(projekt, pakiet, 'package.json')))
    .flatMap((pakiet) => {
      const znalezione = znanePaczki(join(projekt, pakiet, 'package.json'))
      if (typeof znalezione === 'string') return [`Paczki ${pakiet}: ${znalezione}`]
      return znalezione.length ? [`Paczki ${pakiet}: ${znalezione.join(', ')}`] : []
    })
}

/** @param {string} projekt @returns {string} */
function supabase(projekt) {
  if (!existsSync(join(projekt, 'supabase'))) return 'Supabase: brak katalogu supabase/'
  const migracje = wpisy(join(projekt, 'supabase', 'migrations')).filter((p) => p.endsWith('.sql')).length
  const funkcje = wpisy(join(projekt, 'supabase', 'functions')).filter((p) => !p.startsWith('_') && !p.startsWith('.')).length
  return `Supabase: katalog supabase/ (migracje: ${migracje}, Edge Functions: ${funkcje})`
}

/** @param {string} projekt @returns {string} */
function uklad(projekt) {
  const katalogi = KATALOGI_MONOREPO.filter((k) => existsSync(join(projekt, k))).map((k) => `${k}/`)
  if (existsSync(join(projekt, 'pnpm-workspace.yaml'))) return `Uklad: monorepo (pnpm-workspace.yaml; ${katalogi.join(', ') || 'bez apps/ i packages/'})`
  return katalogi.length ? `Uklad: jeden pakiet z katalogami ${katalogi.join(', ')}` : 'Uklad: jeden pakiet'
}

/**
 * @param {string} projekt katalog projektu
 * @returns {string} linie profilu (lista markdown)
 */
export function profilStacku(projekt) {
  const typescript = existsSync(join(projekt, 'tsconfig.json')) ? 'TypeScript: tsconfig.json' : 'TypeScript: brak tsconfig.json'
  return [paczki(projekt), ...paczkiPakietow(projekt), supabase(projekt), typescript, uklad(projekt)].map((l) => `- ${l}`).join('\n')
}

// Runner testow projektu a testy maszynerii z .claude/** (P22 A1). Przypadki z projektow: live-10-demo (`vitest run`
// bez configu — 113 plikow node:test zebranych, STOP autopilota na starcie; potem config z include tests/, commit 1bf65f8)
// i vibersi (config z dwoma projektami i include src/, server/). Gotowa poprawka z wyniku ma sama przejsc sprawdzenie.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { sprawdzRunnerTestow } from '../runner-testow.mjs'

const PAKIET_VITEST = JSON.stringify({ scripts: { test: 'vitest run' }, devDependencies: { vitest: '3.2.4' } })

// vitest.config.ts live-10-demo po 1bf65f8 (dosłownie).
const CONFIG_LIVE_10 = `import { defineConfig } from "vitest/config";

// Tylko testy aplikacji; .claude/** ma własne testy pod node:test.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
`

// vitest.config.ts vibersi (skrót bez komentarzy, układ projektów dosłownie).
const CONFIG_VIBERSI = `import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      passWithNoTests: true,
      projects: [
        { extends: true, test: { name: 'klient', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['src/test/setup.ts'] } },
        { extends: true, test: { name: 'serwer', environment: 'node', include: ['server/**/*.test.ts'] } },
      ],
    },
  }),
)
`

/** @param {Record<string, string>} pliki @param {(projekt: string) => void} cialo */
function wProjekcie(pliki, cialo) {
  const projekt = mkdtempSync(join(tmpdir(), 'runner-'))
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

/** @param {Record<string, string>} pliki */
const sprawdz = (pliki) => {
  /** @type {import('../runner-testow.mjs').WynikRunnera | undefined} */
  let wynik
  wProjekcie(pliki, (p) => { wynik = sprawdzRunnerTestow(p) })
  return /** @type {import('../runner-testow.mjs').WynikRunnera} */ (wynik)
}

test('live-10-demo przed 1bf65f8: vitest run bez configu → BRAK z gotowym vitest.config.ts', () => {
  const w = sprawdz({ 'package.json': PAKIET_VITEST })
  assert.equal(w.stan, 'BRAK')
  assert.equal(w.runner, 'vitest')
  assert.match(w.szczegol, /bez configu zbiera testy maszynerii z \.claude\/\*\*/)
  assert.match(w.poprawka, /^vitest\.config\.ts: .*exclude: \[\.\.\.configDefaults\.exclude, '\.claude\/\*\*'\]/)
})

test('live-10-demo po 1bf65f8 (include tests/) i vibersi (projekty z include src/, server/) → OK', () => {
  assert.deepEqual(sprawdz({ 'package.json': PAKIET_VITEST, 'vitest.config.ts': CONFIG_LIVE_10 }),
    { stan: 'OK', runner: 'vitest', szczegol: 'vitest.config.ts nie zbiera .claude/**', poprawka: '—' })
  assert.equal(sprawdz({ 'package.json': PAKIET_VITEST, 'vitest.config.ts': CONFIG_VIBERSI }).stan, 'OK')
})

test('gotowa poprawka z wyniku wpisana jako config przechodzi sprawdzenie', () => {
  const { poprawka } = sprawdz({ 'package.json': PAKIET_VITEST })
  assert.equal(sprawdz({ 'package.json': PAKIET_VITEST, 'vitest.config.ts': poprawka.replace(/^vitest\.config\.ts: /, '') }).stan, 'OK')
})

test('config bez exclude .claude z include od korzenia albo bez include → BRAK z poprawka exclude', () => {
  for (const config of [
    "export default defineConfig({ test: { include: ['**/*.test.ts'] } })",
    "export default defineConfig({ test: { include: ['src/**/*.test.ts', '*.test.ts'] } })",
    "export default defineConfig({ test: { environment: 'node' } })",
    "export default defineConfig({ test: { coverage: { include: ['src/**'] } } })",
    "export default defineConfig({ test: { include: ['./**/*.test.ts'] } })",
    "export default defineConfig({ test: { include: ['.claude/**/*.test.mjs'] } })",
  ]) {
    const w = sprawdz({ 'package.json': PAKIET_VITEST, 'vitest.config.mts': config })
    assert.equal(w.stan, 'BRAK', config)
    assert.match(w.poprawka, /^w bloku test configu: exclude/, config)
  }
})

test('exclude z .claude chroni takze przy include od korzenia', () => {
  const config = "export default defineConfig({ test: { include: ['**/*.test.ts'], exclude: [...configDefaults.exclude, '.claude/**'] } })"
  assert.equal(sprawdz({ 'package.json': PAKIET_VITEST, 'vitest.config.ts': config }).stan, 'OK')
})

test('vite.config bez bloku test = brak configu testow; z blokiem test i include src/ → OK', () => {
  assert.equal(sprawdz({ 'package.json': PAKIET_VITEST, 'vite.config.ts': 'export default defineConfig({ plugins: [] })' }).stan, 'BRAK')
  const zTestem = "export default defineConfig({ plugins: [], test: { include: ['src/**/*.test.tsx'] } })"
  assert.equal(sprawdz({ 'package.json': PAKIET_VITEST, 'vite.config.ts': zTestem }).stan, 'OK')
})

test('vitest tylko w zaleznosciach (bez skryptu test) tez sprawdzany', () => {
  assert.equal(sprawdz({ 'package.json': JSON.stringify({ devDependencies: { vitest: '3' } }) }).stan, 'BRAK')
})

test('jest: bez configu → BRAK z testPathIgnorePatterns; ignore .claude albo roots <rootDir>/src → OK; roots <rootDir> → BRAK', () => {
  const pakiet = (/** @type {object} */ jest) => JSON.stringify({ scripts: { test: 'jest' }, devDependencies: { jest: '30' }, ...jest })
  const bez = sprawdz({ 'package.json': pakiet({}) })
  assert.deepEqual([bez.stan, bez.runner], ['BRAK', 'jest'])
  assert.match(bez.poprawka, /testPathIgnorePatterns: \['\/node_modules\/', '<rootDir>\/\.claude\/'\]/)
  assert.equal(sprawdz({ 'package.json': pakiet({ jest: { testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'] } }) }).stan, 'OK')
  assert.equal(sprawdz({ 'package.json': pakiet({}), 'jest.config.js': "module.exports = { roots: ['<rootDir>/src'] }" }).stan, 'OK')
  assert.equal(sprawdz({ 'package.json': pakiet({}), 'jest.config.js': "module.exports = { roots: ['<rootDir>'] }" }).stan, 'BRAK')
})

test('projekt bez vitest i jest (np. node --test) → nie dotyczy; brak package.json → nie dotyczy', () => {
  assert.equal(sprawdz({ 'package.json': JSON.stringify({ scripts: { test: "node --test '.claude/**/*.test.mjs'" } }) }).stan, 'nie dotyczy')
  assert.equal(sprawdz({}).stan, 'nie dotyczy')
})

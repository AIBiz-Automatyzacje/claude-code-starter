// Runner testow projektu a testy maszynerii z .claude/** (P22 A1). Przypadki z projektow: live-10-demo (`vitest run`
// bez configu — 113 plikow node:test zebranych, STOP autopilota na starcie; potem config z include tests/, commit 1bf65f8)
// i vibersi (config z dwoma projektami i include src/, server/). Werdykt daje lista runnera (`vitest list --filesOnly
// --json`, `jest --listTests --json`) — tu atrapa w node_modules/.bin, ktora zapisuje argumenty i wypisuje liste z fixture'a.
// Bez runnera zostaje odczyt statyczny: brak configu = BRAK, reszta = UWAGA.

import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { argumentySkryptu, sprawdzRunnerTestow } from '../runner-testow.mjs'

const PAKIET_VITEST = JSON.stringify({ scripts: { test: 'vitest run' }, devDependencies: { vitest: '5.0.5' } })
const TESTY_MASZYNERII = Array.from({ length: 113 }, (_, i) => `.claude/scripts/x/__tests__/t${i}.test.mjs`)

/**
 * @param {Record<string, string>} pliki
 * @param {{ runner?: 'vitest' | 'jest', lista?: string[] | null, kod?: number }} [atrapa] lista = sciezki wzgledne
 *   (atrapa wypisuje je bezwzglednie, jak runner); null = brak atrapy (runner niezainstalowany)
 * @returns {{ wynik: import('../runner-testow.mjs').WynikRunnera, argumenty: string[] }}
 */
function sprawdz(pliki, { runner = 'vitest', lista = null, kod = 0 } = {}) {
  const projekt = mkdtempSync(join(tmpdir(), 'runner-'))
  try {
    for (const [sciezka, tresc] of Object.entries(pliki)) {
      mkdirSync(dirname(join(projekt, sciezka)), { recursive: true })
      writeFileSync(join(projekt, sciezka), tresc)
    }
    if (lista) {
      const json = JSON.stringify(lista.map((p) => (runner === 'vitest' ? { file: join(projekt, p) } : join(projekt, p))))
      const bin = join(projekt, 'node_modules', '.bin', runner)
      mkdirSync(dirname(bin), { recursive: true })
      writeFileSync(join(projekt, 'lista.json'), json)
      writeFileSync(bin, `#!/bin/sh\nprintf '%s\\n' "$@" > "${join(projekt, 'argumenty')}"\necho "ostrzezenie vite" >&2\n${kod ? `echo "Error: config" >&2; exit ${kod}` : `cat "${join(projekt, 'lista.json')}"`}\n`)
      chmodSync(bin, 0o755)
    }
    const wynik = sprawdzRunnerTestow(projekt)
    const argumenty = lista ? readFileSync(join(projekt, 'argumenty'), 'utf8').split('\n').filter(Boolean) : []
    return { wynik, argumenty }
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
}

test('live-10-demo przed 1bf65f8: vitest list zbiera 113 testow .claude → BRAK z gotowym vitest.config.ts', () => {
  const { wynik, argumenty } = sprawdz({ 'package.json': PAKIET_VITEST }, { lista: ['tests/a.test.ts', ...TESTY_MASZYNERII] })
  assert.deepEqual(argumenty, ['list', '--filesOnly', '--json'])
  assert.equal(wynik.stan, 'BRAK')
  assert.equal(wynik.szczegol, 'vitest zbiera 113 plików testów maszynerii z .claude/** (z 114) — run stanie na starcie')
  assert.match(wynik.poprawka, /^vitest\.config\.ts: .*exclude: \[\.\.\.configDefaults\.exclude, '\.claude\/\*\*'\]/)
})

test('live-10-demo po 1bf65f8 i vibersi: lista bez .claude → OK z liczba plikow', () => {
  const { wynik } = sprawdz({ 'package.json': PAKIET_VITEST, 'vitest.config.ts': 'x' }, { lista: ['tests/a.test.ts', 'src/b.test.tsx'] })
  assert.deepEqual(wynik, { stan: 'OK', runner: 'vitest', szczegol: 'vitest: 2 plików testów, 0 z .claude/**', poprawka: '—' })
})

test('exclude bez wartosci domyslnych: lista z node_modules → BRAK; poprawka wskazuje istniejacy config (vite.config bez nowego pliku)', () => {
  const { wynik } = sprawdz({ 'package.json': PAKIET_VITEST, 'vite.config.ts': 'export default {}' }, { lista: ['src/a.test.ts', 'node_modules/zod/x.test.js', 'pkg/node_modules/y/z.test.mjs'] })
  assert.equal(wynik.stan, 'BRAK')
  assert.match(wynik.szczegol, /^vitest zbiera 2 plików testów z node_modules/)
  assert.equal(wynik.poprawka, "w vite.config.ts, w bloku test (dopisz blok, gdy go nie ma): exclude: [...configDefaults.exclude, '.claude/**'] (configDefaults z 'vitest/config')")
})

test('argumenty skryptu test ida do listy: -c, --dir, filtr; bez trybu run/watch i bez reszty po &&', () => {
  const pakiet = JSON.stringify({ scripts: { test: 'vitest run -c vitest.ci.config.ts --dir src && node x.js' }, devDependencies: { vitest: '5' } })
  assert.deepEqual(sprawdz({ 'package.json': pakiet }, { lista: [] }).argumenty, ['list', '--filesOnly', '--json', '-c', 'vitest.ci.config.ts', '--dir', 'src'])
  assert.deepEqual(argumentySkryptu("cross-env X=1 npx vitest --run 'src/'", 'vitest'), ['src/'])
  assert.deepEqual(argumentySkryptu('node_modules/.bin/jest --watchAll; echo', 'jest'), [])
  assert.deepEqual(argumentySkryptu('tsc && echo', 'vitest'), [])
})

test('runner niezainstalowany: bez configu → BRAK (pewne); z configiem → UWAGA z poprawka; vite.config bez test = brak configu', () => {
  const bez = sprawdz({ 'package.json': PAKIET_VITEST }).wynik
  assert.equal(bez.stan, 'BRAK')
  assert.match(bez.szczegol, /^vitest bez configu testów zbiera testy maszynerii z \.claude\/\*\* .*; brak node_modules\/\.bin\/vitest$/)
  const z = sprawdz({ 'package.json': PAKIET_VITEST, 'vitest.config.mts': 'export default {}' }).wynik
  assert.equal(z.stan, 'UWAGA')
  assert.match(z.szczegol, /^nie sprawdzono listy testów \(brak node_modules\/\.bin\/vitest\); vitest\.config\.mts/)
  assert.equal(sprawdz({ 'package.json': PAKIET_VITEST, 'vite.config.ts': 'export default { plugins: [] }' }).wynik.stan, 'BRAK')
  assert.equal(sprawdz({ 'package.json': PAKIET_VITEST, 'vite.config.ts': 'export default { test: { include: ["src/**"] } }' }).wynik.stan, 'UWAGA')
})

test('lista runnera pada (stara wersja, blad configu) → odczyt statyczny z bledem w szczegole', () => {
  const { wynik } = sprawdz({ 'package.json': PAKIET_VITEST }, { lista: [], kod: 1 })
  assert.equal(wynik.stan, 'BRAK')
  assert.match(wynik.szczegol, /; vitest list: ostrzezenie vite$/)
})

test('kolejnosc configu jak w vitest: vitest.config.ts przed .mts i przed vite.config', () => {
  const { wynik } = sprawdz({ 'package.json': PAKIET_VITEST, 'vitest.config.mts': 'x', 'vitest.config.ts': 'x', 'vite.config.ts': 'x' }, { lista: ['.claude/a.test.mjs'] })
  assert.match(wynik.poprawka, /^w vitest\.config\.ts,/)
})

test('jest: --listTests z .claude → BRAK z testPathIgnorePatterns; czysta lista → OK; bez runnera i configu → BRAK', () => {
  const pakiet = JSON.stringify({ scripts: { test: 'jest --ci' }, devDependencies: { jest: '30' } })
  const zly = sprawdz({ 'package.json': pakiet }, { runner: 'jest', lista: ['src/a.test.js', '.claude/b.test.mjs'] })
  assert.deepEqual(zly.argumenty, ['--listTests', '--json', '--ci'])
  assert.equal(zly.wynik.stan, 'BRAK')
  assert.match(zly.wynik.poprawka, /testPathIgnorePatterns: \['\/node_modules\/', '<rootDir>\/\.claude\/'\]/)
  assert.equal(sprawdz({ 'package.json': pakiet }, { runner: 'jest', lista: ['src/a.test.js'] }).wynik.stan, 'OK')
  assert.equal(sprawdz({ 'package.json': pakiet }).wynik.stan, 'BRAK')
  assert.equal(sprawdz({ 'package.json': pakiet, 'jest.config.js': 'module.exports = {}' }).wynik.stan, 'UWAGA')
})

test('wykrycie runnera: skrypt przed zaleznosciami; sama zaleznosc tez; brak obu → nie dotyczy', () => {
  const runner = (/** @type {object} */ p) => sprawdz({ 'package.json': JSON.stringify(p) }).wynik.runner
  assert.equal(runner({ scripts: { test: 'jest' }, devDependencies: { vitest: '5' } }), 'jest')
  assert.equal(runner({ scripts: { test: 'vitest run' } }), 'vitest')
  assert.equal(runner({ scripts: { test: 'npm run unit' }, devDependencies: { jest: '30' } }), 'jest')
  assert.equal(runner({ devDependencies: { vitest: '5' } }), 'vitest')
  assert.equal(sprawdz({ 'package.json': JSON.stringify({ scripts: { test: "node --test '.claude/**/*.test.mjs'" } }) }).wynik.stan, 'nie dotyczy')
  assert.equal(sprawdz({}).wynik.stan, 'nie dotyczy')
})

test('package.json, ktory sie nie parsuje → UWAGA z przyczyna, bez wyjatku', () => {
  const { wynik } = sprawdz({ 'package.json': '{ "scripts": ' })
  assert.equal(wynik.stan, 'UWAGA')
  assert.match(wynik.szczegol, /^package\.json nie parsuje się: /)
})

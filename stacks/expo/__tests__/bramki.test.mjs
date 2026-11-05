// Konfiguracje bramek Expo (IU-2.8) na prawdziwych narzędziach: eslint-plugin-jest, lokalna reguła z `jest.mocked`, Stryker na jest, bez
// size-limit. Paczki daje pakiet workspace `pakiet-bramek`. Wersja web jest pilnowana przez `.claude/templates/bramki/__tests__/`,
// a tutejszy porównuje oba pliki ESLint: zmiana konfiguracji web zatrzymuje test, dopóki ktoś nie przeniesie jej do Expo.
//
// Uruchomienie: node --test stacks/expo/__tests__/bramki.test.mjs

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, symlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { commit, git, noweRepo, usun, zapisz } from '../../../.claude/scripts/bramki/__tests__/repo-testowe.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const WEB = join(KORZEN, '.claude/templates/bramki')
const EXPO = join(KORZEN, 'stacks/expo/nakladka/.claude/templates/bramki')
const PAKIET = join(KORZEN, 'stacks/expo/__tests__/pakiet-bramek')
const SKRYPT = join(KORZEN, '.claude/scripts/bramki/bramki.mjs')
/** @param {string} plik */
const json = (plik) => JSON.parse(readFileSync(plik, 'utf8'))

const SUMA = 'export function suma(a: number, b: number): number {\n  return a + b\n}\n'
const TEST_SUMY = "import { suma } from './suma'\n\ndescribe('suma', () => {\n  it('dodaje', () => {\n    expect(suma(2, 3)).toBe(5)\n  })\n})\n"
const BABEL = "module.exports = { presets: ['@babel/preset-typescript'], plugins: ['@babel/plugin-transform-modules-commonjs'] }\n"
const JEST = "module.exports = { testEnvironment: 'node', roots: ['<rootDir>/src'] }\n"

/** @returns {string} repo projektu-fixture na konfiguracjach Expo, jeden commit bazy */
function projekt() {
  const repo = noweRepo()
  symlinkSync(join(PAKIET, 'node_modules'), join(repo, 'node_modules'))
  copyFileSync(join(EXPO, 'eslint.config.szablon.ts'), join(repo, 'eslint.config.ts'))
  copyFileSync(join(EXPO, 'stryker.config.json'), join(repo, 'stryker.config.json'))
  copyFileSync(join(WEB, 'knip.json'), join(repo, 'knip.json'))
  zapisz(repo, {
    'package.json': JSON.stringify({ name: 'fixture', private: true, type: 'commonjs', devDependencies: json(join(PAKIET, 'package.json')).devDependencies }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2023', module: 'ESNext', moduleResolution: 'bundler', strict: true, jsx: 'preserve', skipLibCheck: true, noEmit: true, types: ['jest'] }, include: ['src', '__tests__'] }),
    '.gitignore': 'node_modules\n',
    'babel.config.cjs': BABEL,
    'jest.config.cjs': JEST,
    'src/suma.ts': SUMA,
    'src/suma.test.ts': TEST_SUMY,
    'src/main.ts': "import { suma } from './suma'\n\nexport const wynik = suma(1, 2)\n",
  })
  commit(repo, 'baza')
  return repo
}

/** @param {string} repo @param {string[]} pliki @returns {{ regula: string | null, poziom: number }[]} */
function lint(repo, pliki) {
  const p = spawnSync(join(repo, 'node_modules', '.bin', 'eslint'), ['--format', 'json', ...pliki], { cwd: repo, encoding: 'utf8' })
  /** @type {{ messages: { ruleId: string | null, severity: number }[] }[]} */
  const raport = JSON.parse(p.stdout)
  return raport.flatMap((r) => r.messages.map((m) => ({ regula: m.ruleId, poziom: m.severity })))
}

const BLAD = 2

// Dozwolone różnice obu plików ESLint, po sprowadzeniu `jest` do `vitest`. Każda inna różnica to zmiana web bez przeniesienia.
const ROZNICE_EXPO = [
  "const TESTY = ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}']",
  "const PREZENTACJA = ['src/app/**', 'app/**', 'src/components/**', 'components/**', 'src/screens/**', 'src/features/**/components/**']",
  "      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect'] }],",
  "import vitest from 'eslint-plugin-jest'",
]
const ROZNICE_WEB = [
  "const TESTY = ['**/*.{test,spec}.{ts,tsx}', '**/*.test-d.{ts,tsx}']",
  "const PREZENTACJA = ['src/components/**', 'src/pages/**', 'src/screens/**', 'src/features/**/components/**']",
  "      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expectTypeOf', 'assertType'] }],",
  "import vitest from '@vitest/eslint-plugin'",
  '      // Testy typow (*.test-d.ts) asercje robia expectTypeOf/assertType.',
]

test('konfiguracja ESLint Expo różni się od web tylko runnerem i ścieżkami', () => {
  /** @param {string} tekst */
  const doWeb = (tekst) => tekst.replaceAll('jest.mocked', 'vi.mocked').replaceAll("name === 'jest'", "name === 'vi'")
    .replaceAll("'jest/", "'vitest/").replaceAll('`jest/', '`vitest/').replaceAll('plugins: { jest,', 'plugins: { vitest,').replace("import jest from 'eslint-plugin-jest'", "import vitest from 'eslint-plugin-jest'")
  const web = readFileSync(join(WEB, 'eslint.config.szablon.ts'), 'utf8').split('\n')
  const expo = doWeb(readFileSync(join(EXPO, 'eslint.config.szablon.ts'), 'utf8')).split('\n')
  assert.deepEqual(expo.filter((l) => !web.includes(l)).sort(), [...ROZNICE_EXPO].sort())
  assert.deepEqual(web.filter((l) => !expo.includes(l)).sort(), [...ROZNICE_WEB].sort())
})

test('lista paczek Expo: bez Vitest i size-limit, z jest; te same wersje narzędzi co web; pakiet testów zgodny z listą', () => {
  const web = json(join(WEB, 'package.json')).devDependencies
  const expo = json(join(EXPO, 'package.json')).devDependencies
  for (const p of ['vitest', '@vitest/eslint-plugin', '@stryker-mutator/vitest-runner', 'size-limit', '@size-limit/file']) assert.equal(expo[p], undefined, p)
  assert.equal(expo['@stryker-mutator/jest-runner'], expo['@stryker-mutator/core'])
  assert.ok(expo['eslint-plugin-jest'])
  for (const [p, wersja] of Object.entries(expo)) {
    if (p in web && p !== 'typescript') assert.equal(wersja, web[p], p)
    assert.match(String(wersja), /^\d/, `${p}: wersja dokładna`)
  }
  const testowe = json(join(PAKIET, 'package.json')).devDependencies
  for (const [p, wersja] of Object.entries(expo)) assert.equal(testowe[p], wersja, p)
})

// Próba na projekcie SDK 58 (jest-expo, 2026-11-05): bez ignorePatterns Stryker kopiuje `ios/Pods` do sandboksu i pada na ENOTSUP.
test('stryker Expo: runner jest, bez katalogów natywnych w sandboksie', () => {
  const s = json(join(EXPO, 'stryker.config.json'))
  assert.equal(s.testRunner, 'jest')
  assert.deepEqual(s.plugins, ['@stryker-mutator/jest-runner'])
  for (const k of ['ios/', 'android/']) assert.ok(s.ignorePatterns.includes(k), k)
})

test('eslint: czysty kod bez uwag; reguły rdzenia i jest łapią defekty', () => {
  const repo = projekt()
  try {
    assert.deepEqual(lint(repo, ['.']), [])
    zapisz(repo, {
      'src/defekty.ts': "export function parsuj(t: string): number | null {\n  try {\n    return Number(JSON.parse(t))\n  } catch {}\n  return null\n}\n",
      'src/lib/supabase.ts': "export const klient = { nazwa: 'supabase' }\n",
      'src/app/logowanie.tsx': "import { klient } from '../lib/supabase'\n\nexport function Logowanie(): string {\n  return klient.nazwa\n}\n",
      '__tests__/slabe-test.ts': "import { suma } from '../src/suma'\n\ndescribe('slabe', () => {\n  it('bez asercji', () => {\n    suma(1, 2)\n  })\n  it('bez argumentow', () => {\n    const f = jest.fn()\n    f(1)\n    expect(f).toHaveBeenCalled()\n  })\n})\n",
    })
    const uwagi = lint(repo, ['src', '__tests__'])
    for (const regula of ['no-empty', 'no-restricted-imports', 'jest/expect-expect', 'jest/prefer-called-with']) {
      assert.equal(uwagi.find((u) => u.regula === regula)?.poziom, BLAD, `${regula} jako error: ${JSON.stringify(uwagi)}`)
    }
  } finally {
    usun(repo)
  }
})

test('eslint: atrapa-z-argumentami rozpoznaje jest.mocked', () => {
  const repo = projekt()
  try {
    zapisz(repo, {
      '__tests__/atrapy-test.ts': "describe('atrapy', () => {\n  it('sama liczba', () => {\n    const f = jest.fn()\n    f(1)\n    expect(f).toHaveBeenCalledTimes(1)\n  })\n})\n",
      '__tests__/atrapy-dobre-test.ts': "describe('atrapy dobre', () => {\n  it('jest.mocked to ta sama atrapa', () => {\n    const f = jest.fn()\n    f(3)\n    expect(f).toHaveBeenCalledTimes(1)\n    expect(jest.mocked(f)).toHaveBeenCalledWith(3)\n  })\n})\n",
    })
    assert.deepEqual(lint(repo, ['__tests__/atrapy-test.ts']).filter((u) => u.regula === 'lokalne/atrapa-z-argumentami'), [{ regula: 'lokalne/atrapa-z-argumentami', poziom: BLAD }])
    assert.deepEqual(lint(repo, ['__tests__/atrapy-dobre-test.ts']), [])
  } finally {
    usun(repo)
  }
})

test('eslint.config.ts przechodzi tsc', () => {
  const repo = projekt()
  try {
    zapisz(repo, {
      'tsconfig.konfiguracja.json': JSON.stringify({
        compilerOptions: { target: 'ES2023', module: 'ESNext', moduleResolution: 'bundler', strict: true, skipLibCheck: true, noEmit: true, types: ['node'], typeRoots: [join(KORZEN, 'node_modules/@types')] },
        include: ['eslint.config.ts'],
      }),
    })
    const p = spawnSync(join(repo, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.konfiguracja.json'], { cwd: repo, encoding: 'utf8' })
    assert.equal(p.status, 0, p.stdout + p.stderr)
  } finally {
    usun(repo)
  }
})

test('bramki.mjs z runnerem jest: czysto, potem defekty: ESLint, Stryker na jest; bez bramek Vitest i size-limit; drzewo bez śmieci', () => {
  const repo = projekt()
  /** @param {string} baza */
  const bramki = (baza) => {
    const p = spawnSync(process.execPath, [SKRYPT, '--baza', baza], { cwd: repo, encoding: 'utf8' })
    return { kod: p.status, wynik: JSON.parse(p.stdout) }
  }
  try {
    const baza = git(repo, ['rev-parse', 'HEAD'])
    const czysto = bramki(baza)
    assert.equal(czysto.kod, 0, JSON.stringify(czysto.wynik))
    assert.equal(czysto.wynik.sizeLimit.status, 'brak')
    assert.equal(czysto.wynik.testyTypow.status, 'brak')

    zapisz(repo, {
      'src/suma.ts': SUMA.replace('  return a + b', '  if (a < 0) return 0\n  return a + b'),
      'src/suma.test.ts': TEST_SUMY.replace('expect(suma(2, 3)).toBe(5)', "expect(typeof suma(2, 3)).toBe('number')"),
      'src/defekty.ts': "export function parsuj(t: string): number | null {\n  try {\n    return Number(JSON.parse(t))\n  } catch {}\n  return null\n}\n",
    })
    const { kod, wynik } = bramki(baza)
    assert.equal(kod, 1)
    assert.deepEqual(wynik.eslint.trafienia.map((/** @type {{ regula: string }} */ t) => t.regula), ['no-empty'])
    assert.equal(wynik.stryker.status, 'ok', JSON.stringify(wynik.stryker))
    assert.ok(wynik.stryker.trafienia.length > 0, JSON.stringify(wynik.stryker))
    assert.ok(wynik.stryker.trafienia.every((/** @type {{ plik: string, linia: number }} */ t) => t.plik === 'src/suma.ts' && t.linia === 2), JSON.stringify(wynik.stryker.trafienia))
    assert.equal(existsSync(join(repo, '.stryker-tmp')), false)
    assert.equal(git(repo, ['status', '--porcelain', '--ignored', '--', '.', ':!node_modules']).split('\n').filter((l) => l.startsWith('!!')).length, 0)
  } finally {
    usun(repo)
  }
})

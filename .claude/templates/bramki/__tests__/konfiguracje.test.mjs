// Odbior konfiguracji bramek z szablonu prawdziwymi narzedziami (pakiet workspace @szablon/bramki): projekt-fixture
// z eslint.config.szablon.ts (jako eslint.config.ts), knip.json, .size-limit.json i stryker.config.json z tego katalogu, node_modules = dowiazanie do
// node_modules pakietu bramek. ESLint: kazda regula z PLAN-POPRAWY P6 lapie swoj defekt. Caly skrypt bramek: faza czysta
// -> faza z defektami (kazda bramka z wlasciwa regula) -> naprawa -> faza czysta, drzewo bez smieci, czas w budzecie.

import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, symlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { commit, git, noweRepo, usun, zapisz } from '../../../scripts/bramki/__tests__/repo-testowe.mjs'

const BRAMKI = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKRYPT = resolve(BRAMKI, '..', '..', 'scripts', 'bramki', 'bramki.mjs')
// Szablon ESLint ma nazwe spoza wzorca eslint.config.* — ESLint 10 szuka konfiguracji od katalogu pliku i wzialby go
// jako zagniezdzona konfiguracje .claude/templates/bramki/ (w projekcie bez zaleznosci bramek `eslint .` by padl).
const KONFIGURACJE = { 'eslint.config.szablon.ts': 'eslint.config.ts', 'knip.json': 'knip.json', '.size-limit.json': '.size-limit.json', 'stryker.config.json': 'stryker.config.json' }
// Budzet z testu review (PLAN-POPRAWY P6, smoke): wszystkie bramki razem.
const BUDZET_SEKUND = 143
// Build jak Vite (emptyOutDir): czysty dist, potem kompilacja — tsc --outDir sam nie usuwa plikow po skasowanym zrodle.
const BUILD = `node -e "require('node:fs').rmSync('dist', { recursive: true, force: true })" && tsc -p tsconfig.json --noEmit false --outDir dist/assets`

/** @typedef {{ plik: string | null, linia: number | null, regula: string, opis: string }} Trafienie */
/** @typedef {Record<string, { status: string, trafienia: Trafienie[], ostrzezenia?: Trafienie[], zastane?: number }>} WynikBramek */

const SUMA = 'export function suma(a: number, b: number): number {\n  return a + b\n}\n'
const TEST_SUMY = `import { describe, expect, it } from 'vitest'

import { suma } from './suma'

describe('suma', () => {
  it('dodaje', () => {
    expect(suma(2, 3)).toBe(5)
  })
})
`

/** @returns {string} repo projektu-fixture z konfiguracjami szablonu i jednym commitem bazy */
function projekt() {
  const repo = noweRepo()
  symlinkSync(join(BRAMKI, 'node_modules'), join(repo, 'node_modules'))
  for (const [szablon, plik] of Object.entries(KONFIGURACJE)) copyFileSync(join(BRAMKI, szablon), join(repo, plik))
  const { devDependencies } = JSON.parse(readFileSync(join(BRAMKI, 'package.json'), 'utf8'))
  zapisz(repo, {
    'package.json': JSON.stringify({ name: 'fixture', private: true, type: 'module', scripts: { build: BUILD }, devDependencies }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2023', module: 'ESNext', moduleResolution: 'bundler', strict: true, jsx: 'preserve', skipLibCheck: true, noEmit: true, types: [] }, include: ['src'] }),
    '.gitignore': 'node_modules\ndist\n',
    'src/suma.ts': SUMA,
    'src/suma.test.ts': TEST_SUMY,
    'src/main.ts': "import { suma } from './suma'\n\nexport const wynik = suma(1, 2)\n",
    'supabase/migrations/20260101000000_init.sql': 'create table t (id int);\n',
    // Maszyneria z sync-template: nieuzywany plik z globalem Node — lint albo knip na .claude/ dalby uwage.
    '.claude/scripts/narzedzie.mjs': 'export const kod = process.exitCode\n',
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
const OSTRZEZENIE = 1

test('eslint.config.ts: czysty kod bez uwag, kazda regula P6 lapie swoj defekt z wlasciwym poziomem', () => {
  const repo = projekt()
  try {
    assert.deepEqual(lint(repo, ['.']), [])

    zapisz(repo, {
      'src/defekty.ts': `export function parsuj(tekst: string): number | null {
  try {
    return Number(JSON.parse(tekst))
  } catch {}
  return null
}

export async function zapisz(): Promise<void> {
  await Promise.resolve()
}

export function uruchom(): void {
  zapisz()
  console.log('start')
}

export function pierwszy(lista: string[]): string {
  return lista[0]!
}
`,
      'src/lib/supabase.ts': "export const klient = { nazwa: 'supabase' }\n",
      'src/components/logowanie.tsx': "import { klient } from '../lib/supabase'\n\nexport function Logowanie(): string {\n  return klient.nazwa\n}\n",
      'src/components/zegar.tsx': 'export function Zegar() {\n  const teraz = Date.now()\n  return <span>{teraz}</span>\n}\n',
      'src/kolejnosc.ts': "import { suma } from './suma'\nimport { wynik } from './main'\n\nexport const x = suma(1, 2) + wynik\n",
      'src/cykl-a.ts': "import { b } from './cykl-b'\n\nexport const a = (): number => b() + 1\n",
      'src/cykl-b.ts': "import { a } from './cykl-a'\n\nexport const b = (): number => 1\nexport const c = (): number => a()\n",
      'src/dlugi.ts': Array.from({ length: 361 }, (_, i) => `export const s${i} = ${i}`).join('\n') + '\n',
      'src/dluga-funkcja.ts': `export function f(): number {\n  let x = 0\n${Array.from({ length: 60 }, (_, i) => `  x += ${i}\n`).join('')}  return x\n}\n`,
      'src/slabe.test.ts': `import { describe, expect, it, vi } from 'vitest'

import { suma } from './suma'

describe('slabe', () => {
  it('bez asercji', () => {
    suma(1, 2)
  })
  it('wywolanie bez argumentow', () => {
    const f = vi.fn()
    f(1)
    expect(f).toHaveBeenCalled()
  })
})
`,
    })
    const uwagi = lint(repo, ['src'])
    const poziom = (/** @type {string} */ regula) => uwagi.find((u) => u.regula === regula)?.poziom
    for (const regula of [
      'no-empty', '@typescript-eslint/no-floating-promises', 'no-console', 'no-restricted-imports', 'import-x/order', 'import-x/no-cycle',
      'max-lines', 'max-lines-per-function', 'react-hooks/purity', 'vitest/expect-expect', 'vitest/prefer-called-with',
      // recommendedTypeChecked = error
      '@typescript-eslint/no-unnecessary-type-assertion',
    ]) assert.equal(poziom(regula), BLAD, `${regula} jako error`)
    // strictTypeChecked spoza recommended = warn
    assert.equal(poziom('@typescript-eslint/no-non-null-assertion'), OSTRZEZENIE)
  } finally {
    usun(repo)
  }
})

/** @param {string} repo @param {string} baza @returns {{ kod: number | null, wynik: WynikBramek, sekundy: number }} */
function bramki(repo, baza) {
  const start = performance.now()
  const p = spawnSync(process.execPath, [SKRYPT, '--baza', baza], { cwd: repo, encoding: 'utf8', env: { ...process.env, SUPABASE_ACCESS_TOKEN: '' } })
  return { kod: p.status, wynik: JSON.parse(p.stdout), sekundy: (performance.now() - start) / 1000 }
}

/** @param {WynikBramek} wynik @param {string} bramka @returns {string[]} */
const reguly = (wynik, bramka) => wynik[bramka].trafienia.map((t) => t.regula)

/** Dane, ktorych brotli nie sciska: lancuch skrotow SHA-256, ~290 kB po kompresji (budzet 250 kB). */
function duzaPaczka() {
  let skrot = 'x'
  const czesci = []
  for (let i = 0; i < 9000; i++) {
    skrot = createHash('sha256').update(skrot).digest('hex')
    czesci.push(skrot)
  }
  return `export const DANE = ${JSON.stringify(czesci.join(''))}\n`
}

test('bramki.mjs na konfiguracjach szablonu: czysto -> defekty (kazda bramka z regula) -> naprawa -> czysto', () => {
  const repo = projekt()
  try {
    execFileSync(process.execPath, [SKRYPT, '--dopisz-sume'], { cwd: repo })
    const baza = commit(repo, 'suma migracji')
    const czysto = bramki(repo, baza)
    assert.equal(czysto.kod, 0, JSON.stringify(czysto.wynik))
    assert.equal(czysto.wynik.knip.zastane, 0)

    zapisz(repo, {
      'src/defekty.ts': "export function parsuj(t: string): number | null {\n  try {\n    return Number(JSON.parse(t))\n  } catch {}\n  return null\n}\n",
      'src/suma.ts': `${SUMA.replace('  return a + b', '  if (a < 0) return 0\n  return a + b')}\nexport const martwy = 1\n`,
      'src/suma.test.ts': TEST_SUMY.replace("it('dodaje'", "it('dodaje liczby'").replace('expect(suma(2, 3)).toBe(5)', "expect(typeof suma(2, 3)).toBe('number')"),
      'src/suma.test-d.ts': "import { expectTypeOf, test } from 'vitest'\n\nimport { suma } from './suma'\n\ntest('typ sumy', () => {\n  expectTypeOf(suma(1, 2)).toEqualTypeOf<number>()\n})\n",
      'src/duzy.ts': duzaPaczka(),
      'src/main.ts': "import { DANE } from './duzy'\nimport { suma } from './suma'\n\nexport const wynik = suma(1, 2) + DANE.length\n",
      'supabase/migrations/20260101000000_init.sql': 'create table t (id int);\n-- edycja wypchnietej migracji\n',
    })
    const defekty = bramki(repo, baza)
    assert.equal(defekty.kod, 1)
    const w = defekty.wynik
    assert.deepEqual(reguly(w, 'eslint'), ['no-empty'])
    assert.deepEqual(reguly(w, 'knip').sort(), ['knip/exports', 'knip/files'])
    assert.deepEqual(reguly(w, 'sizeLimit'), ['size-limit'])
    assert.deepEqual(reguly(w, 'migracje'), ['niezmiennosc-migracji'])
    assert.deepEqual(reguly(w, 'migracjeSuma'), ['migrations-sum'])
    assert.equal(w.testyTypow.status, 'ok')
    assert.deepEqual(w.testyUsuniete.trafienia.map((t) => t.opis), ['dodaje'])
    // Stryker mutuje tylko linie fazy: dodany warunek przezywa przy tescie `typeof`.
    assert.ok(w.stryker.trafienia.length > 0)
    assert.ok(w.stryker.trafienia.every((t) => t.plik === 'src/suma.ts' && t.linia === 2), JSON.stringify(w.stryker.trafienia))

    zapisz(repo, {
      'src/defekty.ts': "export function parsuj(t: string): number | null {\n  try {\n    return Number(JSON.parse(t))\n  } catch (e) {\n    throw new Error('zly JSON', { cause: e })\n  }\n}\n",
      'src/suma.ts': SUMA,
      'src/suma.test.ts': TEST_SUMY,
      'src/main.ts': "import { parsuj } from './defekty'\nimport { suma } from './suma'\n\nexport const wynik = suma(1, 2) + (parsuj('1') ?? 0)\n",
      'supabase/migrations/20260101000000_init.sql': 'create table t (id int);\n',
    })
    usun(join(repo, 'src', 'duzy.ts'))
    const naprawa = bramki(repo, baza)
    assert.equal(naprawa.kod, 0, JSON.stringify(naprawa.wynik))

    assert.equal(git(repo, ['status', '--porcelain', '--ignored', '--', '.', ':!node_modules', ':!dist']).split('\n').filter((l) => l.startsWith('!!')).length, 0)
    assert.equal(existsSync(join(repo, '.stryker-tmp')), false)
    assert.ok(defekty.sekundy < BUDZET_SEKUND, `bramki ${defekty.sekundy} s`)
  } finally {
    usun(repo)
  }
})

// Test pliku regul kodu (.claude/rules/coding-rules.md) — PLAN-POPRAWY P12.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/coding-rules.test.mjs
//
// DLACZEGO: plik regul czytaja buildery, fix i sesja glowna projektu. Przed P12 mial dwa progi rozmiaru (tekst 300/50,
// ESLint 360/60), sprzecznosc „wydzielaj wspolna logike” vs „duplikacja lepsza niz zlozonosc”, tabele opisujaca
// skłonnosci modelu i ladowal sie kazdemu agentowi (10,5k zn w telemetrii smoke'a R-P11). Reguly pilnowane przez ESLint
// zostaja w tekscie jednym blokiem, bo projekt bez konfiguracji ESLint z szablonu nie ma innego zrodla tych regul.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const REGULY = readFileSync(resolve(REPO, '.claude/rules/coding-rules.md'), 'utf8')
const ESLINT = readFileSync(resolve(REPO, '.claude/templates/bramki/eslint.config.szablon.ts'), 'utf8')

/**
 * @param {string} tekst
 * @param {string} naglowek
 * @returns {string}
 */
function sekcja(tekst, naglowek) {
  const start = tekst.indexOf(`\n## ${naglowek}\n`)
  assert.notEqual(start, -1, `brak sekcji "## ${naglowek}"`)
  const koniec = tekst.indexOf('\n## ', start + 1)
  return tekst.slice(start, koniec === -1 ? undefined : koniec)
}

/**
 * @param {string} regula
 * @returns {number}
 */
function progEslint(regula) {
  const m = new RegExp(`'${regula}': \\['error', \\{ max: (\\d+)`).exec(ESLINT)
  assert.ok(m, `brak progu ${regula} w eslint.config.szablon.ts`)
  return Number(m[1])
}

test('plik laduje sie po typie pliku (paths: kod i SQL), nie kazdemu agentowi', () => {
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(REGULY)
  assert.ok(frontmatter, 'brak frontmattera')
  assert.match(frontmatter[1], /^paths:$/m)
  assert.match(frontmatter[1], /\*\*\/\*\.\{ts,tsx,js,jsx,mjs,cjs\}/)
  assert.match(frontmatter[1], /\*\*\/\*\.sql/)
})

test('progi rozmiaru w tekscie = progi ESLint z szablonu i wystepuja tylko w bloku ESLint', () => {
  const blok = sekcja(REGULY, 'Pilnuje ESLint i bramki domknięcia')
  assert.match(blok, new RegExp(`${progEslint('max-lines')} linii na plik`))
  assert.match(blok, new RegExp(`${progEslint('max-lines-per-function')} na funkcję`))
  const pozaBlokiem = REGULY.replace(blok, '')
  assert.doesNotMatch(pozaBlokiem, /\b\d{2,3} linii\b/, 'prog linii poza blokiem ESLint')
})

test('usuniete bloki nie wracaja: tabela anty-patternow, quality gate, filozofia review, procenty bez zrodla', () => {
  for (const fraza of ['Katalog 10', 'Quality gate', 'Filozofia review', '80-90%', 'AbortController w cleanup']) {
    assert.ok(!REGULY.includes(fraza), `fraza "${fraza}" w pliku regul`)
  }
})

test('jeden prog wydzielania wspolnej logiki (bez sprzecznosci „2+ uzycia” vs „duplikacja lepsza”)', () => {
  assert.match(REGULY, /przy trzecim użyciu/)
  assert.doesNotMatch(REGULY, /2\+ użycia/)
  assert.doesNotMatch(REGULY, /Duplication > Complexity/)
})

test('naglowki bez numerow — odwolania do regul ida po temacie', () => {
  assert.doesNotMatch(REGULY, /^## \d/m)
})

test('bez wersalikow nacisku', () => {
  assert.doesNotMatch(REGULY, /\b(NIGDY|ZAWSZE|MUSI|PYTAJ|KAŻDY|KOD|PRZED)\b/)
})

test('maszyneria odwoluje sie do regul kodu po temacie, nie po numerze sekcji', () => {
  const katalog = resolve(REPO, '.claude')
  const trafienia = readdirSync(katalog, { recursive: true, encoding: 'utf8' })
    .filter((p) => !p.includes('node_modules') && !p.includes('__tests__') && /\.(md|mjs|js|ts|yaml|sh)$/.test(p))
    .flatMap((p) => {
      const tekst = readFileSync(join(katalog, p), 'utf8')
      return /coding-rules`?\s*§/.test(tekst) ? [p] : []
    })
  assert.deepEqual(trafienia, [])
})

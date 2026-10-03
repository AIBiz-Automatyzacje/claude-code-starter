// Odbior bramki ESLint na prawdziwym ESLint szablonu (rdzen + @eslint/js przez dowiazanie node_modules):
// przejscie -> naruszenie (pusty catch) -> porazka z regula no-empty -> przejscie; warn na liniach fazy = ostrzezenie.

import { symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { zmianyFazy } from '../diff.mjs'
import { bramkaEslint } from '../eslint.mjs'
import { wykryjNarzedzia } from '../narzedzia.mjs'
import { FIXTURES, commit, noweRepo, usun, zapisz } from './repo-testowe.mjs'

const NODE_MODULES_SZABLONU = resolve(FIXTURES, '..', '..', '..', '..', '..', 'node_modules')

const KONFIGURACJA = `import js from '@eslint/js'
export default [
  js.configs.recommended,
  { languageOptions: { globals: { console: 'readonly' } }, rules: { 'no-console': 'warn' } },
]
`
const CZYSTY = `export function wczytaj(tekst) {
  try {
    return JSON.parse(tekst)
  } catch (e) {
    throw new Error('zly JSON', { cause: e })
  }
}
`

/** @returns {{ repo: string, baza: string }} */
function projekt() {
  const repo = noweRepo()
  symlinkSync(NODE_MODULES_SZABLONU, join(repo, 'node_modules'))
  zapisz(repo, { '.gitignore': 'node_modules\n', 'eslint.config.js': KONFIGURACJA, 'src/stary.js': 'export const stary = 1\n' })
  return { repo, baza: commit(repo, 'baza') }
}

/** @param {string} repo @param {string} baza */
function bramka(repo, baza) {
  const n = wykryjNarzedzia(repo).eslint
  assert.ok(n.jest, 'ESLint szablonu niewykryty w fixture')
  return bramkaEslint(repo, n, zmianyFazy(repo, baza))
}

test('przejscie -> pusty catch -> porazka no-empty z plikiem i linia -> przejscie', () => {
  const { repo, baza } = projekt()
  try {
    zapisz(repo, { 'src/json.js': CZYSTY })
    const przed = bramka(repo, baza)
    assert.equal(przed.status, 'ok', JSON.stringify(przed))
    assert.deepEqual(przed.trafienia, [])

    zapisz(repo, { 'src/json.js': CZYSTY.replace("throw new Error('zly JSON', { cause: e })", '').replace('(e)', '') })
    const naruszenie = bramka(repo, baza)
    assert.equal(naruszenie.status, 'porazka')
    assert.deepEqual(naruszenie.trafienia.map((t) => [t.plik, t.linia, t.regula]), [['src/json.js', 4, 'no-empty']])

    zapisz(repo, { 'src/json.js': CZYSTY })
    assert.equal(bramka(repo, baza).status, 'ok')
  } finally {
    usun(repo)
  }
})

test('warn na linii fazy = ostrzezenie (wejscie code-quality), status ok; warn poza fazy pominiety', () => {
  const { repo } = projekt()
  try {
    zapisz(repo, { 'src/stary.js': 'console.log(1)\nexport const stary = 1\n' })
    const baza = commit(repo, 'stary console sprzed fazy')
    zapisz(repo, {
      'src/stary.js': 'console.log(1)\nexport const stary = 1\nexport const nowy = 2\n',
      'src/log.js': 'export function loguj(x) {\n  console.log(x)\n}\n',
    })
    const w = bramka(repo, baza)
    assert.equal(w.status, 'ok')
    assert.deepEqual(w.ostrzezenia?.map((t) => [t.plik, t.linia, t.regula]), [['src/log.js', 2, 'no-console']])
  } finally {
    usun(repo)
  }
})

test('faza bez plikow kodu = pominieta; zepsuta konfiguracja = blad z komunikatem ESLint', () => {
  const { repo, baza } = projekt()
  try {
    zapisz(repo, { 'README.md': '# opis\n' })
    const pominieta = bramka(repo, baza)
    assert.equal(pominieta.status, 'pominieta')

    zapisz(repo, { 'src/a.js': 'export const a = 1\n', 'eslint.config.js': 'export default [{ rules: { "nie-ma-takiej-reguly": "error" } }]\n' })
    const blad = bramka(repo, baza)
    assert.equal(blad.status, 'blad')
    assert.match(blad.powod ?? '', /nie-ma-takiej-reguly/)
  } finally {
    usun(repo)
  }
})

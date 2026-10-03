// Sygnaly diffu do dossier na repo-fixture: flagi warstw w schemacie KONTEKST (ui / dane / typowanie / nowyModul —
// pomylka w gore jest tania, w dol gubi reviewera) i pre-skan dodanych linii (pusty catch, .then bez .catch w pliku).

import test from 'node:test'
import assert from 'node:assert/strict'

import { commit, noweRepo, usun, zapisz } from '../../bramki/__tests__/repo-testowe.mjs'
import { dodaneLinie, preSkan, warstwy } from '../sygnaly.mjs'
import { zmianyDossier } from '../zmiany.mjs'

/** @param {Record<string, string>} przed @param {Record<string, string>} po @param {(repo: string, s: ReturnType<typeof sygnaly>) => void} sprawdz */
function naRepo(przed, po, sprawdz) {
  const repo = noweRepo()
  try {
    zapisz(repo, przed)
    const baza = commit(repo, 'baza')
    zapisz(repo, po)
    sprawdz(repo, sygnaly(repo, baza))
  } finally {
    usun(repo)
  }
}

/** @param {string} repo @param {string} baza */
function sygnaly(repo, baza) {
  const { pliki, diff } = zmianyDossier(repo, baza)
  const dodane = dodaneLinie(diff)
  return { warstwy: warstwy(repo, pliki, dodane), preSkan: preSkan(repo, dodane) }
}

test('warstwy: faza z czystą funkcja TS w nowym pliku = typowanie i nowyModul, bez ui i danych', () => {
  naRepo({ 'README.md': '# x\n' }, { 'src/suma.ts': 'export function suma(a: number, b: number): number {\n  return a + b\n}\n', 'src/suma.test.ts': 'test\n' }, (_, s) => {
    assert.deepEqual(s.warstwy, { ui: false, dane: false, typowanie: true, nowyModul: true })
  })
})

test('warstwy: komponent tsx i style = ui; fetch w dodanej linii albo migracja SQL = dane; edycja istniejacego .mjs bez tsconfig', () => {
  naRepo({ 'src/App.tsx': 'export const App = () => null\n' }, { 'src/App.tsx': 'export const App = () => <div />\n', 'src/app.css': 'a {}\n' }, (_, s) => {
    assert.equal(s.warstwy.ui, true)
    assert.equal(s.warstwy.nowyModul, false, 'nowy plik stylu to nie nowy modul kodu')
  })
  naRepo({ 'lib/api.mjs': 'export const x = 1\n' }, { 'lib/api.mjs': 'export const x = 1\nexport const y = () => fetch("/api")\n' }, (_, s) => {
    assert.deepEqual(s.warstwy, { ui: false, dane: true, typowanie: false, nowyModul: false })
  })
  naRepo({ 'tsconfig.json': '{}' }, { 'supabase/migrations/001_a.sql': 'create table a (id int);\n' }, (_, s) => {
    assert.equal(s.warstwy.dane, true)
    assert.equal(s.warstwy.typowanie, true, 'tsconfig.json w korzeniu = typowanie w grze')
  })
})

test('preSkan: pusty catch w dodanych liniach (tez przez nowa linie) i .then bez .catch w calym pliku; plik:linia', () => {
  const kod = [
    'export function a(t: string) {',
    '  try {',
    '    return JSON.parse(t)',
    '  } catch {',
    '  }',
    '}',
    'export const b = () => fetch("/x").then((r) => r.json())',
    'try { a("") } catch (e) {}',
    '',
  ].join('\n')
  naRepo({ 'README.md': '' }, { 'src/a.ts': kod, 'src/ok.ts': 'export const c = () => fetch("/y").then((r) => r).catch(() => null)\n' }, (_, s) => {
    assert.deepEqual(s.preSkan, [
      { wzorzec: 'pusty-catch', plik: 'src/a.ts:4' },
      { wzorzec: 'pusty-catch', plik: 'src/a.ts:8' },
      { wzorzec: 'then-bez-catch', plik: 'src/a.ts:7' },
    ])
  })
})

test('preSkan: wzorzec w niezmienionej linii nie jest trafieniem', () => {
  naRepo({ 'src/a.ts': 'try { x() } catch {}\n' }, { 'src/a.ts': 'try { x() } catch {}\nexport const y = 1\n' }, (_, s) => {
    assert.deepEqual(s.preSkan, [])
  })
})

test('preSkan: dwa puste catch w jednej linii = jedno miejsce', () => {
  naRepo({ 'README.md': '' }, { 'src/a.ts': 'try { x() } catch {} try { y() } catch {}\n' }, (_, s) => {
    assert.deepEqual(s.preSkan, [{ wzorzec: 'pusty-catch', plik: 'src/a.ts:1' }])
  })
})

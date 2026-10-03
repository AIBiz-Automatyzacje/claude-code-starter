// Zmiany fazy do dossier na repo-fixture: lista plikow ze statusem i liczbami linii (takze usuniete i niesledzone),
// pelny diff z kontekstem do pliku z limitem rozmiaru, baza zastepcza (merge-base z galezia glowna) bez --baza.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { commit, git, noweRepo, usun, zapisz } from '../../bramki/__tests__/repo-testowe.mjs'
import { ZNACZNIK_UCIECIA, bazaZastepcza, zapiszDiff, zmianyDossier } from '../zmiany.mjs'

test('zmianyDossier: dodane, zmienione, usuniete i niesledzone pliki fazy ze statusem i liczbami linii; diff z trescia', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { 'src/a.ts': 'export const a = 1\n', 'src/b.ts': 'export const b = 2\n', 'docs/c.md': '# c\n' })
    const baza = commit(repo, 'baza')
    zapisz(repo, { 'src/a.ts': 'export const a = 10\nexport const a2 = 2\n', 'src/d.ts': 'export const d = 4\n' })
    git(repo, ['rm', '-q', 'src/b.ts'])
    commit(repo, 'faza')
    zapisz(repo, { 'src/e.ts': 'export const e = 5\nexport const e2 = 6\n' })

    const { pliki, diff } = zmianyDossier(repo, baza)
    assert.deepEqual(pliki, [
      { plik: 'src/a.ts', status: 'M', dodane: 2, usuniete: 1 },
      { plik: 'src/b.ts', status: 'D', dodane: 0, usuniete: 1 },
      { plik: 'src/d.ts', status: 'A', dodane: 1, usuniete: 0 },
      { plik: 'src/e.ts', status: 'A', dodane: 2, usuniete: 0 },
    ])
    assert.match(diff, /\+export const d = 4/)
    assert.match(diff, /\+export const e2 = 6/, 'plik niesledzony tez jest w diffie')
    assert.doesNotMatch(diff, /docs\/c\.md/)
  } finally {
    usun(repo)
  }
})

test('zapiszDiff: ponizej limitu caly; powyzej przyciety ze znacznikiem; pusty diff = niezapisany', () => {
  const katalog = mkdtempSync(join(tmpdir(), 'diff-'))
  try {
    const plik = join(katalog, 'faza.diff')
    assert.deepEqual(zapiszDiff('abc\n', plik, 10), { zapisany: true, uciety: false })
    assert.equal(readFileSync(plik, 'utf8'), 'abc\n')
    assert.deepEqual(zapiszDiff('0123456789abcdef', plik, 10), { zapisany: true, uciety: true })
    assert.equal(readFileSync(plik, 'utf8'), `0123456789\n${ZNACZNIK_UCIECIA}\n`)
    assert.deepEqual(zapiszDiff('', plik, 10), { zapisany: false, uciety: false })
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

test('bazaZastepcza: merge-base z galezia glowna; bez galezi glownej = HEAD', () => {
  const repo = noweRepo()
  try {
    git(repo, ['branch', '-M', 'main'])
    zapisz(repo, { 'a.ts': 'a\n' })
    const naMain = commit(repo, 'main')
    git(repo, ['checkout', '-q', '-b', 'feature/x'])
    zapisz(repo, { 'b.ts': 'b\n' })
    commit(repo, 'faza')
    assert.equal(bazaZastepcza(repo), naMain)
    git(repo, ['branch', '-q', '-m', 'main', 'inna'])
    assert.equal(bazaZastepcza(repo), 'HEAD')
  } finally {
    usun(repo)
  }
})

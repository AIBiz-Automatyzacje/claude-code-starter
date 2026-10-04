// Odczyt wpisow wiedzy z docs/solutions/ projektu (PLAN-POPRAWY P10): solution z polami wiedzy = wpis; bez pol
// (sprzed konwersji) = poza wiedza; z polami niepoprawnymi = lista bledow; _archived pomijane.

import test from 'node:test'
import assert from 'node:assert/strict'

import { noweRepo, usun, zapisz } from '../../bramki/__tests__/repo-testowe.mjs'
import { plikiRepo, wczytajWpisy } from '../wpisy.mjs'

const POLA = [
  'klasa: sciezka-bledu', 'regula: "Blad zapisu pokazuj uzytkownikowi."', 'paths:', '  - "src/lib/**"', 'waga: wysoka',
  'szczebel: regula', 'szczebel_powod: "zachowanie, nie skladnia"', 'date: 2026-09-01', 'zrodlo: "PR 3"', 'ucieczki: 0',
]

test('wczytajWpisy: poprawny wpis, solution bez pol wiedzy, wpis z bledem i archiwum', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, {
      'src/lib/zapis.ts': 'export {}\n',
      'docs/solutions/runtime-errors/2026-09-01-ok.md': `---\ntitle: ok\n${POLA.join('\n')}\n---\n# ok\n`,
      'docs/solutions/ui-bugs/2026-08-01-stary.md': '---\ntitle: stary\ndate: 2026-08-01\n---\n# stary\n',
      'docs/solutions/ui-bugs/2026-09-02-zly.md': `---\n${POLA.join('\n').replace('src/lib/**', 'app/**')}\n---\n`,
      'docs/solutions/_archived/2026-07-01-a.md': `---\n${POLA.join('\n')}\n---\n`,
      'docs/solutions/README.md': '# bez frontmattera\n',
    })
    const w = wczytajWpisy(repo, plikiRepo(repo))
    assert.deepEqual(w.wpisy.map((x) => x.plik), ['docs/solutions/runtime-errors/2026-09-01-ok.md'])
    assert.deepEqual(w.bezPol.sort(), ['docs/solutions/README.md', 'docs/solutions/ui-bugs/2026-08-01-stary.md'])
    assert.deepEqual(w.niepoprawne, [{ plik: 'docs/solutions/ui-bugs/2026-09-02-zly.md', bledy: ['paths: glob "app/**" nie pasuje do zadnego pliku repo'] }])
  } finally {
    usun(repo)
  }
})

test('wczytajWpisy: projekt bez docs/solutions = brak wpisow, bez bledu', () => {
  const repo = noweRepo()
  try {
    assert.deepEqual(wczytajWpisy(repo, []), { wpisy: [], bezPol: [], niepoprawne: [] })
  } finally {
    usun(repo)
  }
})

test('plikiRepo: pliki sledzone i nowe nieignorowane, bez ignorowanych', () => {
  const repo = noweRepo()
  try {
    zapisz(repo, { '.gitignore': 'dist/\n', 'src/a.ts': '', 'dist/b.js': '' })
    assert.deepEqual(plikiRepo(repo).sort(), ['.gitignore', 'src/a.ts'])
  } finally {
    usun(repo)
  }
})

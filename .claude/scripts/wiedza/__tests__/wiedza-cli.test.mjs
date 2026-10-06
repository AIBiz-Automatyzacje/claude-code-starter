// CLI wiedzy projektu (PLAN-POPRAWY P10) na repo-fixture: sprawdz (compound odmawia zapisu bez pol), indeks z bramka,
// wycinek dla plikow, konwersja przygotuj → zastosuj. Wynik JSON na stdout; kod 0 = ok, 1 = do poprawy, 2 = zle argumenty.

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { noweRepo, usun, zapisz } from '../../bramki/__tests__/repo-testowe.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const CLI = resolve(KATALOG, '..', 'wiedza.mjs')

/** @param {Record<string, string | string[]>} pola */
function solution(pola) {
  const linie = Object.entries(pola).map(([k, v]) => (Array.isArray(v) ? `${k}:\n${v.map((e) => `  - "${e}"`).join('\n')}` : `${k}: ${JSON.stringify(v)}`))
  return `---\n${linie.join('\n')}\n---\n\n# Problem\n`
}

const POLA = {
  klasa: 'sciezka-bledu', regula: 'Blad zapisu pokazuj uzytkownikowi.', paths: ['src/lib/**'], waga: 'wysoka', szczebel: 'regula',
  szczebel_powod: 'zachowanie', date: '2026-09-01', zrodlo: 'PR 3', ucieczki: '0',
}

/** @param {string} repo @param {string[]} argumenty */
function uruchom(repo, argumenty) {
  const w = spawnSync(process.execPath, [CLI, ...argumenty, '--projekt', repo], { encoding: 'utf8' })
  return { kod: w.status, json: w.stdout ? JSON.parse(w.stdout) : null, stderr: w.stderr }
}

/** @param {(repo: string) => void} cialo */
function wRepo(cialo) {
  const repo = noweRepo()
  try {
    zapisz(repo, { 'src/lib/zapis.ts': 'export {}\n', 'src/components/A.tsx': 'export {}\n' })
    cialo(repo)
  } finally {
    usun(repo)
  }
}

test('sprawdz: solution bez pol wiedzy = kod 1 z bledami (compound nie zapisuje); kompletne = kod 0', () => {
  wRepo((repo) => {
    zapisz(repo, { 'docs/solutions/a/zly.md': '---\ntitle: x\n---\n', 'docs/solutions/a/ok.md': solution(POLA) })
    const zly = uruchom(repo, ['sprawdz', 'docs/solutions/a/zly.md', 'docs/solutions/a/ok.md'])
    assert.equal(zly.kod, 1)
    assert.equal(zly.json.ok, false)
    assert.equal(zly.json.pliki[0].ok, false)
    assert.ok(zly.json.pliki[0].bledy.some((/** @type {string} */ b) => b.startsWith('klasa:')))
    assert.deepEqual(zly.json.pliki[1], { plik: 'docs/solutions/a/ok.md', ok: true, bledy: [] })
    assert.equal(uruchom(repo, ['sprawdz', 'docs/solutions/a/ok.md']).kod, 0)
    assert.equal(uruchom(repo, ['sprawdz', 'docs/solutions/a/nie-ma.md']).json.pliki[0].bledy[0], 'plik nie istnieje')
  })
})

test('indeks --zapisz: zapis docs/learned-patterns.md; bramka koszyka zawsze = kod 1 i stary indeks zostaje', () => {
  wRepo((repo) => {
    zapisz(repo, { 'docs/solutions/a/ok.md': solution(POLA), 'docs/solutions/a/zly.md': solution({ ...POLA, klasa: 'inna' }) })
    const ok = uruchom(repo, ['indeks', '--zapisz'])
    assert.equal(ok.kod, 1, 'niepoprawny wpis zglaszany kodem 1')
    assert.deepEqual(ok.json.niepoprawne.map((/** @type {{ plik: string }} */ n) => n.plik), ['docs/solutions/a/zly.md'])
    assert.equal(ok.json.zapisany, true)
    const indeks = readFileSync(join(repo, 'docs/learned-patterns.md'), 'utf8')
    assert.match(indeks, /\| sciezka-bledu \| Blad zapisu pokazuj uzytkownikowi\. \|/)
    zapisz(repo, Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`docs/solutions/z/${i}.md`, solution({ ...POLA, regula: `Zawsze ${i}.`, paths: ['**'] })])))
    const brama = uruchom(repo, ['indeks', '--zapisz'])
    assert.equal(brama.kod, 1)
    assert.equal(brama.json.zapisany, false)
    assert.match(brama.json.bledy[0], /^koszyk "zawsze": 6 wpisow/)
    assert.equal(readFileSync(join(repo, 'docs/learned-patterns.md'), 'utf8'), indeks)
  })
})

test('indeks bez --zapisz: sam wynik, bez pliku; zle argumenty = kod 2', () => {
  wRepo((repo) => {
    zapisz(repo, { 'docs/solutions/a/ok.md': solution(POLA) })
    const w = uruchom(repo, ['indeks'])
    assert.equal(w.kod, 0)
    assert.equal(w.json.wpisy, 1)
    assert.equal(existsSync(join(repo, 'docs/learned-patterns.md')), false)
    assert.equal(uruchom(repo, ['nieznana']).kod, 2)
    assert.equal(uruchom(repo, ['wycinek']).kod, 2, 'wycinek bez --pliki')
  })
})

test('wycinek --pliki: reguly dla plikow jednostki, takze nowego pliku w katalogu', () => {
  wRepo((repo) => {
    zapisz(repo, {
      'docs/solutions/a/lib.md': solution(POLA),
      'docs/solutions/a/ui.md': solution({ ...POLA, regula: 'Fokus po zamknieciu dialogu.', klasa: 'a11y', paths: ['src/components/**'] }),
    })
    const w = uruchom(repo, ['wycinek', '--pliki', 'src/lib/nowy.ts, docs/x.md'])
    assert.equal(w.kod, 0)
    assert.deepEqual(w.json.pliki, ['docs/solutions/a/lib.md'])
    assert.equal(w.json.tresc, '- [wysoka] sciezka-bledu: Blad zapisu pokazuj uzytkownikowi. (docs/solutions/a/lib.md)')
    assert.equal(w.json.zapobieganie, undefined, 'zdania D10 tylko na zadanie (planner) — reviewerzy i fix bez nich')
  })
})

test('wycinek --zapobieganie: reguly projektu, potem zdania klas bez klasy reguly, jeden blok w limicie', () => {
  wRepo((repo) => {
    zapisz(repo, { 'docs/solutions/a/lib.md': solution(POLA) })
    const w = uruchom(repo, ['wycinek', '--zapobieganie', '--pliki', 'src/lib/nowy.ts'])
    assert.equal(w.kod, 0)
    const [regula, naglowek, ...zdania] = w.json.tresc.split('\n')
    assert.equal(regula, '- [wysoka] sciezka-bledu: Blad zapisu pokazuj uzytkownikowi. (docs/solutions/a/lib.md)')
    assert.match(naglowek ?? '', /co robić zamiast:$/)
    assert.ok(zdania.length > 0 && !w.json.zapobieganie.klasy.includes('sciezka-bledu'), w.json.zapobieganie.klasy.join(', '))
    assert.ok(w.json.tresc.length <= 2000 && w.json.zn === w.json.tresc.length, `${w.json.zn}`)
    assert.equal(w.json.zapobieganie.klasy.length, zdania.length)
    const ciasny = uruchom(repo, ['wycinek', '--zapobieganie', '--limit', '300', '--pliki', 'src/lib/nowy.ts'])
    assert.ok(ciasny.json.tresc.length <= 300 && ciasny.json.zapobieganie.pominiete > 0, ciasny.json.tresc)
    for (const limit of [400, 500, 650, 900]) {
      const w2 = uruchom(repo, ['wycinek', '--zapobieganie', '--limit', String(limit), '--pliki', 'src/lib/nowy.ts'])
      assert.ok(w2.json.tresc.length <= limit, `limit ${limit}: ${w2.json.tresc.length} zn — zdania dostaja limit bez odjecia regul`)
      assert.match(w2.json.tresc, /^- \[wysoka\] sciezka-bledu: /, 'regula projektu zawsze przed zdaniami')
    }
  })
})

test('konwersja przygotuj → zastosuj: pola w solutions, indeks, stary plik i odrzuty w docs/archiwum/', () => {
  wRepo((repo) => {
    zapisz(repo, {
      '.claude/rules/learned-patterns.md': '# Learned Patterns\n\n- **Blad zapisu pokazuj uzytkownikowi**: toast zamiast ciszy.\n  Source: docs/solutions/a/zapis.md\n- **Bez zrodla**: x.\n',
      'docs/solutions/a/zapis.md': '---\ntitle: "zapis"\ndate: 2026-08-01\nseverity: high\n---\n\nPlik `src/lib/zapis.ts`.\n',
    })
    const k = uruchom(repo, ['konwersja', 'przygotuj'])
    assert.equal(k.kod, 0)
    assert.deepEqual(k.json.map((/** @type {{ paths: string[] }} */ x) => x.paths), [['src/lib/**'], []])
    k.json[0].klasa = 'sciezka-bledu'
    const plik = join(repo, 'propozycje.json')
    writeFileSync(plik, JSON.stringify(k.json))
    const z = uruchom(repo, ['konwersja', 'zastosuj', '--propozycje', plik, '--data', '2026-10-04'])
    assert.equal(z.kod, 1, 'odrzut = kod 1 (operator ma liste)')
    assert.deepEqual(z.json.zapisane, [{ nr: 1, plik: 'docs/solutions/a/zapis.md' }])
    assert.deepEqual(z.json.odrzuty.map((/** @type {{ nr: number }} */ o) => o.nr), [2])
    assert.equal(z.json.indeks.wpisy, 1)
    assert.match(readFileSync(join(repo, 'docs/learned-patterns.md'), 'utf8'), /\| sciezka-bledu \| Blad zapisu pokazuj uzytkownikowi\. \| `src\/lib\/\*\*` \| wysoka \|/)
    assert.deepEqual(z.json.archiwum, { plik: 'docs/archiwum/learned-patterns-2026-10-04.md', odrzuty: 'docs/archiwum/learned-patterns-odrzuty-2026-10-04.md' })
    assert.equal(existsSync(join(repo, '.claude/rules/learned-patterns.md')), false)
  })
})

test('konwersja zastosuj: niepoprawny JSON propozycji albo brak pliku learned-patterns = kod 2, nic nie zapisane', () => {
  wRepo((repo) => {
    assert.equal(uruchom(repo, ['konwersja', 'przygotuj']).kod, 2)
    zapisz(repo, { '.claude/rules/learned-patterns.md': '- **R**: x.\n', 'p.json': '{zly' })
    assert.equal(uruchom(repo, ['konwersja', 'zastosuj', '--propozycje', join(repo, 'p.json')]).kod, 2)
    assert.equal(existsSync(join(repo, '.claude/rules/learned-patterns.md')), true)
  })
})

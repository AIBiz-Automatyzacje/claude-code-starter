// Jednorazowa konwersja .claude/rules/learned-patterns.md projektu na pola wiedzy w solutions (PLAN-POPRAWY P10, PW11):
// skrypt wyciaga kandydatow (regula, zrodla, waga, wzorce plikow z tresci solution), agent dopisuje klase ze slownika,
// skrypt sprawdza i zapisuje; czego nie da sie zapisac — lista odrzutow dla operatora. Fixture: fragment pliku oferty.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { noweRepo, usun, zapisz } from '../../bramki/__tests__/repo-testowe.mjs'
import { czytajFrontmatter } from '../frontmatter.mjs'
import { archiwizuj, kandydaci, zastosuj } from '../konwersja.mjs'
import { plikiRepo } from '../wpisy.mjs'

const LP = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/learned-patterns-oferty.md'), 'utf8')
const HEALTH = 'docs/solutions/deployment-issues/2026-08-25-healthcheck-kontenera-rollback-mimo-dzialajacego-procesu.md'
const LIMITER = 'docs/solutions/deployment-issues/2026-08-25-rate-limiter-kluczowany-naglowkiem-klienta-za-reverse-proxy.md'
const TESTY = 'docs/solutions/testing-issues/2026-09-06-testy-o-luznym-ksztalcie-strip-zamiast-strict-optional-chaining-atrapa-szersza-od-kontraktu-seed-z-defaultem.md'

/** @param {string} severity @param {string} date @param {string} tresc */
const solution = (severity, date, tresc) => `---\ntitle: "x"\ndate: ${date}\nseverity: ${severity}\n---\n\n${tresc}\n`

/** @param {(repo: string) => void} cialo */
function wRepo(cialo) {
  const repo = noweRepo()
  try {
    zapisz(repo, {
      'Dockerfile': 'FROM alpine\n',
      'src/lib/rate-limit.ts': 'export {}\n',
      'src/lib/ip.ts': 'export {}\n',
      [HEALTH]: solution('critical', '2026-08-25', 'Sonda w `Dockerfile` bez curl.'),
      [LIMITER]: solution('high', '2026-08-25', 'Klucz w `src/lib/rate-limit.ts` i lib/ip.ts; stary `server/proxy.ts` usuniety.'),
      [TESTY]: solution('medium', '2026-09-06', 'Bez sciezek.'),
    })
    cialo(repo)
  } finally {
    usun(repo)
  }
}

test('kandydaci: kazda regula z pliku, tytul jako propozycja reguly, zrodla, waga z severity, data z solution', () => {
  wRepo((repo) => {
    const k = kandydaci(LP, repo, plikiRepo(repo))
    assert.equal(k.length, 4)
    assert.deepEqual(k.map((x) => x.nr), [1, 2, 3, 4])
    assert.equal(k[0].regula, 'Health check kontenera to osobny klient, nie ruch produkcyjny.')
    assert.deepEqual({ solution: k[0].solution, waga: k[0].waga, date: k[0].date, klasa: k[0].klasa }, { solution: HEALTH, waga: 'wysoka', date: '2026-08-25', klasa: '' })
    assert.match(k[0].tresc, /^sonda działa w minimalnym obrazie/)
    assert.equal(k[2].zrodla.length, 2, 'regula z dwiema liniami Source')
    assert.equal(k[2].solution, TESTY, 'pierwsze istniejace zrodlo')
    assert.equal(k[2].waga, 'srednia')
  })
})

test('kandydaci: wzorce plikow z sciezek cytowanych w solution, ktore istnieja w repo (takze po sufiksie)', () => {
  wRepo((repo) => {
    const k = kandydaci(LP, repo, plikiRepo(repo))
    assert.deepEqual(k[1].paths, ['src/lib/**'])
    assert.deepEqual(k[0].paths, ['Dockerfile'])
    assert.deepEqual(k[2].paths, [])
  })
})

test('kandydaci: sciezki dokumentacji (docs/, .claude/, pliki .md) nie sa wzorcami — wiedza dotyczy kodu', () => {
  wRepo((repo) => {
    zapisz(repo, { 'CLAUDE.md': '', 'docs/completed/f1/plan.md': '', '.claude/rules/x.md': '' })
    const lp = LP.replace(TESTY, LIMITER)
    zapisz(repo, { [LIMITER]: solution('high', '2026-08-25', 'Zob. `CLAUDE.md`, docs/completed/f1/plan.md, .claude/rules/x.md i `src/lib/ip.ts`.') })
    assert.deepEqual(kandydaci(lp, repo, plikiRepo(repo))[1].paths, ['src/lib/**'])
  })
})

test('kandydaci: regula bez linii Source i ze zrodlem nieistniejacym — solution null z uwaga', () => {
  wRepo((repo) => {
    const k = kandydaci(LP, repo, plikiRepo(repo))
    assert.equal(k[3].solution, null)
    assert.deepEqual(k[3].uwagi, ['brak linii Source'])
    const bezPliku = kandydaci(LP.replace(HEALTH, 'docs/solutions/x/nie-ma.md'), repo, plikiRepo(repo))
    assert.equal(bezPliku[0].solution, null)
    assert.deepEqual(bezPliku[0].uwagi, ['zrodlo nie istnieje: docs/solutions/x/nie-ma.md'])
  })
})

const DZIS = '2026-10-04'

/** @param {string} repo @returns {import('../konwersja.mjs').Kandydat[]} kandydaci z klasa dopisana jak przez agenta */
function propozycje(repo) {
  const k = kandydaci(LP, repo, plikiRepo(repo))
  k[0].klasa = 'spojnosc-dwoch-systemow'
  k[1].klasa = 'zaufanie-danym-klienta'
  k[3].klasa = 'sciezka-bledu'
  return k
}

test('zastosuj: zapis pol wiedzy do solution (data solution, zrodlo konwersji, ucieczki 0); reszta naglowka bez zmian', () => {
  wRepo((repo) => {
    const w = zastosuj(repo, LP, propozycje(repo), plikiRepo(repo), DZIS)
    assert.deepEqual(w.zapisane, [{ nr: 1, plik: HEALTH }, { nr: 2, plik: LIMITER }])
    const pola = czytajFrontmatter(readFileSync(join(repo, LIMITER), 'utf8'))?.pola
    assert.deepEqual(pola, {
      title: 'x', date: '2026-08-25', severity: 'high', klasa: 'zaufanie-danym-klienta',
      regula: 'Klucz limitera/hasha IP bierz z adresu połączenia, nie z nagłówka.', paths: ['src/lib/**'], waga: 'wysoka',
      szczebel: 'regula', szczebel_powod: 'konwersja learned-patterns: regula tekstowa sprzed P10, bez bramki mechanicznej',
      zrodlo: `learned-patterns (konwersja ${DZIS})`, ucieczki: '0',
    })
  })
})

test('zastosuj: odrzuty z powodem — bledy walidacji, brak solution, brak propozycji', () => {
  wRepo((repo) => {
    const k = propozycje(repo)
    const w = zastosuj(repo, LP, k.slice(0, 3).concat(k[3]).filter((x) => x.nr !== 1), plikiRepo(repo), DZIS)
    assert.deepEqual(w.odrzuty.map((o) => [o.nr, o.powod]), [
      [1, 'brak propozycji dla reguly'],
      [3, 'klasa: "" spoza slownika klas defektow (.claude/scripts/wiedza/klasy.mjs); paths: wymagana niepusta lista globow (wszedzie: "**")'],
      [4, 'brak solution: brak linii Source'],
    ])
    assert.equal(w.odrzuty[0].tytul, 'Health check kontenera to osobny klient, nie ruch produkcyjny')
  })
})

test('zastosuj: solution spoza zrodel reguly albo poza docs/solutions odrzucone; druga regula do tego samego solution odrzucona', () => {
  wRepo((repo) => {
    const k = propozycje(repo)
    k[0].solution = LIMITER
    k[1].solution = '../poza/repo.md'
    const w = zastosuj(repo, LP, k.slice(0, 2), plikiRepo(repo), DZIS)
    assert.deepEqual(w.zapisane, [])
    assert.match(w.odrzuty[0].powod, /^solution spoza zrodel reguly/)
    assert.match(w.odrzuty[1].powod, /^solution spoza zrodel reguly/)
    const dwa = propozycje(repo)
    dwa[1].solution = HEALTH
    dwa[1].zrodla = [HEALTH]
    const d = zastosuj(repo, LP.replace(LIMITER, HEALTH), dwa.slice(0, 2), plikiRepo(repo), DZIS)
    assert.deepEqual(d.zapisane, [{ nr: 1, plik: HEALTH }])
    assert.deepEqual(d.odrzuty.filter((o) => o.nr === 2).map((o) => o.powod), [`solution ma juz regule z nr 1: ${HEALTH}`])
  })
})

test('zastosuj: propozycja o zlym ksztalcie (z pliku agenta) = odrzut, bez wyjatku', () => {
  wRepo((repo) => {
    const w = zastosuj(repo, LP, [{ nr: 1, klasa: 7 }, 'x'], plikiRepo(repo), DZIS)
    assert.deepEqual(w.zapisane, [])
    assert.equal(w.odrzuty.find((o) => o.nr === 1)?.powod, 'zly ksztalt propozycji (nr, klasa, regula, paths, solution, waga)')
  })
})

test('zastosuj: Source z segmentem .. w pliku projektu nie wyprowadza zapisu poza docs/solutions', () => {
  wRepo((repo) => {
    zapisz(repo, { 'docs/poza.md': '---\ntitle: poza\n---\n' })
    const lp = LP.replace(HEALTH, 'docs/solutions/../poza.md')
    const k = kandydaci(lp, repo, plikiRepo(repo))
    assert.equal(k[0].solution, null)
    assert.deepEqual(k[0].uwagi, ['zrodlo poza docs/solutions: docs/solutions/../poza.md'])
    k[0].klasa = 'spojnosc-dwoch-systemow'
    k[0].solution = 'docs/solutions/../poza.md'
    const w = zastosuj(repo, lp, [k[0]], plikiRepo(repo), DZIS)
    assert.deepEqual(w.zapisane, [])
    assert.match(w.odrzuty[0].powod, /^solution spoza zrodel reguly albo poza docs\/solutions/)
    assert.equal(readFileSync(join(repo, 'docs/poza.md'), 'utf8'), '---\ntitle: poza\n---\n')
  })
})

test('archiwizuj: stary plik przeniesiony (nie skasowany) do docs/archiwum/, odrzuty z tytulem i powodem obok', () => {
  wRepo((repo) => {
    zapisz(repo, { '.claude/rules/learned-patterns.md': LP })
    const a = archiwizuj(repo, LP, [{ nr: 4, tytul: 'Regula bez zrodla', powod: 'brak solution: brak linii Source' }], DZIS)
    assert.deepEqual(a, { plik: `docs/archiwum/learned-patterns-${DZIS}.md`, odrzuty: `docs/archiwum/learned-patterns-odrzuty-${DZIS}.md` })
    assert.equal(existsSync(join(repo, '.claude/rules/learned-patterns.md')), false)
    assert.equal(readFileSync(join(repo, a.plik), 'utf8'), LP)
    const odrzuty = readFileSync(join(repo, a.odrzuty), 'utf8')
    assert.match(odrzuty, /^- nr 4 — Regula bez zrodla: brak solution: brak linii Source$/m)
    assert.match(odrzuty, /\(1 z 4 regul\)/)
  })
})

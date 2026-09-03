// Test batchowania sceptykow P2 i domykania werdyktow z dev-docs-review-wf.js.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/sceptycy-p2.test.mjs
//   albo caly katalog:  node --test '.claude/workflows/__tests__/*.test.mjs'   (glob w apostrofach)
// Dlaczego ekstrakcja ze zrodla zamiast importu — patrz naglowek bloker-srodowiska.test.mjs.
//
// Kontekst (audyt 2026-09-02, pozycje A7 i B4): verify bylo 55% agentow calego runu. P2 sa teraz
// grupowane po pliku (jeden sceptyk otwiera plik raz), a `domknijWerdykty` jest JEDYNYM miejscem,
// w ktorym werdykty zamieniaja sie w finding — i musi dzialac tak samo dla P1 (3 glosy) i dla P2 (1 glos).
// Najwazniejsza wlasnosc: zaden brak glosu nie moze zamienic sie w ciche obalenie findingu.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const PLIK_WORKFLOWU = resolve(KATALOG, '../dev-docs-review-wf.js')
const zrodlo = readFileSync(PLIK_WORKFLOWU, 'utf8')

function wytnij(odMarkera, doMarkera) {
  const start = zrodlo.indexOf(odMarkera)
  assert.notEqual(start, -1, `nie znaleziono "${odMarkera}" — kotwica testu wymaga aktualizacji`)
  const koniec = zrodlo.indexOf(doMarkera, start)
  assert.notEqual(koniec, -1, `nie znaleziono konca dla "${odMarkera}"`)
  return zrodlo.slice(start, koniec + doMarkera.length)
}

// kluczPliku jest zalezoscia grupujPoPliku; domknijWerdykty inkrementuje dwa liczniki z zewnatrz.
const fragment = [
  'let severityKorektyPrzyjete = 0',
  'let severityKorektyOdrzucone = 0',
  wytnij('function kluczPliku(', '\n}'),
  wytnij('function domknijWerdykty(', '\n}'),
  wytnij('function grupujPoPliku(', '\n}'),
].join('\n')

// eslint-disable-next-line no-new-func — jedyna droga do niewyeksportowanych jednostek w skrypcie workflowu;
// wejsciem jest plik z tego repo, nie dane uzytkownika.
const { domknijWerdykty, grupujPoPliku, liczniki } = new Function(
  `${fragment}\nreturn { domknijWerdykty, grupujPoPliku, liczniki: () => ({ przyjete: severityKorektyPrzyjete, odrzucone: severityKorektyOdrzucone }) }`
)()

const finding = (severity, plik, typ = 'KOD') => ({ severity, typ, plik, opis: `problem w ${plik}`, _zrodlo: 'security' })
const glos = (realny, severityKorekta = null) => ({ realny, uzasadnienie: '—', severityKorekta })

// ── Grupowanie P2 po pliku ─────────────────────────────────────────────────

test('findingi z tego samego pliku trafiaja do jednej grupy, niezaleznie od numeru linii', () => {
  const grupy = grupujPoPliku([
    finding('P2', 'src/deliver.ts:214'),
    finding('P2', 'src/deliver.ts:31'),
    finding('P2', 'src/worker.ts:132'),
  ], 4)
  assert.equal(grupy.length, 2)
  assert.equal(grupy.find((g) => g[0].plik.startsWith('src/deliver.ts')).length, 2)
  assert.equal(grupy.find((g) => g[0].plik.startsWith('src/worker.ts')).length, 1)
})

test('grupa jest tniona do maksymalnego rozmiaru — dluga lista rozmywa skepse', () => {
  const grupy = grupujPoPliku(Array.from({ length: 9 }, (_, i) => finding('P2', `src/a.ts:${i}`)), 4)
  assert.deepEqual(grupy.map((g) => g.length), [4, 4, 1])
})

test('kazdy finding trafia do dokladnie jednej grupy — nic nie ginie i nic sie nie dubluje', () => {
  const lista = [
    finding('P2', 'src/a.ts:1'), finding('P2', 'src/b.ts:2'), finding('P2', 'src/a.ts:3'),
    finding('P2', '?'), finding('P2', 'src/c.ts:5'),
  ]
  const wSumie = grupujPoPliku(lista, 2).flat()
  assert.equal(wSumie.length, lista.length)
  assert.deepEqual(new Set(wSumie), new Set(lista))
})

test('pusta lista P2 nie tworzy pustej grupy (inaczej odpalilby sie sceptyk bez findingow)', () => {
  assert.deepEqual(grupujPoPliku([], 4), [])
})

// ── domknijWerdykty: brak glosu ────────────────────────────────────────────

test('zero glosow = NIEZWERYFIKOWANY i przepuszczony, nigdy obalony', () => {
  const wynik = domknijWerdykty(finding('P2', 'src/a.ts:1'), [])
  assert.equal(wynik.potwierdzony, true, 'awaria sceptyka nie moze kasowac findingu')
  assert.match(wynik.opis, /^\[NIEZWERYFIKOWANY — 0 glosow sceptykow\]/)
})

// ── domknijWerdykty: jeden glos (sciezka P2) ───────────────────────────────

test('jeden glos "nierealny" obala finding P2', () => {
  const wynik = domknijWerdykty(finding('P2', 'src/a.ts:1'), [glos(false)])
  assert.equal(wynik.potwierdzony, false)
})

test('jeden glos NIE zmienia severity — sugestia idzie do opisu (regresja z A7)', () => {
  const przed = liczniki().odrzucone
  const wynik = domknijWerdykty(finding('P2', 'src/a.ts:1'), [glos(true, 'P3')])
  assert.equal(wynik.severity, 'P2', 'pojedynczy sceptyk nie moze przeklasyfikowac findingu')
  assert.match(wynik.opis, /\[sceptyk sugeruje P3\]$/)
  assert.equal(liczniki().odrzucone, przed + 1, 'odrzucona korekta ma byc policzona, inaczej zmiana jest niemierzalna')
})

test('jeden glos bez korekty nie dopisuje niczego do opisu', () => {
  const f = finding('P2', 'src/a.ts:1')
  const wynik = domknijWerdykty(f, [glos(true)])
  assert.equal(wynik.opis, f.opis)
})

test('korekta rowna dotychczasowemu severity nie jest sugestia', () => {
  const f = finding('P2', 'src/a.ts:1')
  const wynik = domknijWerdykty(f, [glos(true, 'P2')])
  assert.equal(wynik.opis, f.opis)
  assert.equal(wynik.severity, 'P2')
})

// ── domknijWerdykty: trzy glosy (sciezka P1) ───────────────────────────────

test('P1 przezywa, gdy tylko jeden z trzech sceptykow go obalil', () => {
  const wynik = domknijWerdykty(finding('P1', 'src/a.ts:1'), [glos(true), glos(false), glos(true)])
  assert.equal(wynik.potwierdzony, true)
})

test('P1 pada przy konsensusie 2 z 3', () => {
  const wynik = domknijWerdykty(finding('P1', 'src/a.ts:1'), [glos(false), glos(false), glos(true)])
  assert.equal(wynik.potwierdzony, false)
})

test('zgodna wiekszosc MOZE skorygowac severity P1', () => {
  const przed = liczniki().przyjete
  const wynik = domknijWerdykty(finding('P1', 'src/a.ts:1'), [glos(true, 'P2'), glos(true, 'P2'), glos(true)])
  assert.equal(wynik.severity, 'P2')
  assert.equal(liczniki().przyjete, przed + 1)
})

test('rozproszone korekty nie zmieniaja severity — dwa rozne glosy to nie wiekszosc', () => {
  const wynik = domknijWerdykty(finding('P1', 'src/a.ts:1'), [glos(true, 'P2'), glos(true, 'P3'), glos(true)])
  assert.equal(wynik.severity, 'P1')
})

// ── Kotwice wywolania w workflowie ─────────────────────────────────────────

test('wiring — P1 nadal dostaje trzech niezaleznych sceptykow, P2 ida grupami', () => {
  assert.match(zrodlo, /Array\.from\(\{ length: 3 \}, \(_, i\) =>/, 'P1 musi zostac przy trzech osobnych glosach')
  assert.match(zrodlo, /const grupyP2 = grupujPoPliku\(p2DoVerify, MAKS_W_GRUPIE_P2\)/)
  assert.match(zrodlo, /const MAKS_W_GRUPIE_P2 = 4/)
})

test('wiring — grupa, ktorej thunk padl, schodzi do niezweryfikowanej zamiast wyparowac', () => {
  assert.match(
    zrodlo,
    /Array\.isArray\(wynikGrupy\) \? wynikGrupy : grupyP2\[i\]\.map\(\(f\) => domknijWerdykty\(f, \[\]\)\)/,
    'null z parallel() nie moze zabrac ze soba findingow calej grupy'
  )
})

test('wiring — tiery sa wystawione przez args, z tanszym packagerem i sceptykiem P2', () => {
  assert.match(zrodlo, /const TIERY_DOMYSLNE = \{ packager: 'low', sceptykP2: 'medium', sceptykP1: null, reviewer: null \}/)
  assert.match(zrodlo, /const tiery = \{ \.\.\.TIERY_DOMYSLNE, \.\.\.\(\(args && args\.tiery\) \|\| \{\}\) \}/)
})

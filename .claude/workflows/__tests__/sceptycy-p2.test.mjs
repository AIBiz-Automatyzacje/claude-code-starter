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

/**
 * @param {string} odMarkera
 * @param {string} doMarkera
 * @returns {string}
 */
function wytnij(odMarkera, doMarkera) {
  const start = zrodlo.indexOf(odMarkera)
  assert.notEqual(start, -1, `nie znaleziono "${odMarkera}" — kotwica testu wymaga aktualizacji`)
  const koniec = zrodlo.indexOf(doMarkera, start)
  assert.notEqual(koniec, -1, `nie znaleziono konca dla "${odMarkera}"`)
  return zrodlo.slice(start, koniec + doMarkera.length)
}

// kluczPliku jest zalezoscia porcjujP2; domknijWerdykty inkrementuje dwa liczniki z zewnatrz.
const fragment = [
  'let severityKorektyPrzyjete = 0',
  'let severityKorektyOdrzucone = 0',
  wytnij('function kluczPliku(', '\n}'),
  wytnij('function domknijWerdykty(', '\n}'),
  wytnij('function porcjujP2(', '\n}'),
].join('\n')

/** @typedef {import('./typy.mjs').Finding} Finding */
/** @typedef {import('./typy.mjs').Glos} Glos */

// Wyjatek od no-new-func: jedyna droga do niewyeksportowanych jednostek w skrypcie workflowu;
// wejsciem jest plik z tego repo, nie dane uzytkownika.
/** @type {{ domknijWerdykty: (f: Finding, glosy: Glos[]) => Finding & { potwierdzony: boolean, _uzasadnienie?: string }, porcjujP2: (lista: Finding[], maks: number) => Finding[][], liczniki: () => { przyjete: number, odrzucone: number } }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { domknijWerdykty, porcjujP2, liczniki } = new Function(
  `${fragment}\nreturn { domknijWerdykty, porcjujP2, liczniki: () => ({ przyjete: severityKorektyPrzyjete, odrzucone: severityKorektyOdrzucone }) }`
)()

/** @type {(severity: string, plik: string, typ?: string) => Finding} */
const finding = (severity, plik, typ = 'KOD') => ({ severity, typ, plik, opis: `problem w ${plik}`, _zrodlo: 'security' })
/** @type {(realny: boolean, severityKorekta?: string | null) => Glos} */
const glos = (realny, severityKorekta = null) => ({ realny, uzasadnienie: '—', severityKorekta })

// ── Porcje P2 (P9, D2): batch po 4 niezaleznie od pliku ─────────────────────
// Zmiana kontraktu (P9): grupa po pliku dawala 80% grup jednoelementowych (~1 agent na finding);
// porcja po 4 niezaleznie od pliku, posortowana po pliku, zeby findingi z jednego pliku staly obok siebie.

test('13 findingow P2 z roznych plikow = 4 agentow', () => {
  const porcje = porcjujP2(Array.from({ length: 13 }, (_, i) => finding('P2', `src/plik${i}.ts:1`)), 4)
  assert.deepEqual(porcje.map((g) => g.length), [4, 4, 4, 1])
})

test('findingi z tego samego pliku stoja obok siebie, niezaleznie od numeru linii i kolejnosci wejscia', () => {
  const porcje = porcjujP2([
    finding('P2', 'src/worker.ts:132'),
    finding('P2', 'src/deliver.ts:214'),
    finding('P2', 'src/zeta.ts:1'),
    finding('P2', 'src/deliver.ts:31'),
  ], 2)
  assert.deepEqual(porcje[0].map((f) => f.plik), ['src/deliver.ts:214', 'src/deliver.ts:31'])
})

test('kazdy finding trafia do dokladnie jednej porcji — nic nie ginie i nic sie nie dubluje', () => {
  const lista = [
    finding('P2', 'src/a.ts:1'), finding('P2', 'src/b.ts:2'), finding('P2', 'src/a.ts:3'),
    finding('P2', '?'), finding('P2', 'src/c.ts:5'),
  ]
  const wSumie = porcjujP2(lista, 2).flat()
  assert.equal(wSumie.length, lista.length)
  assert.deepEqual(new Set(wSumie), new Set(lista))
})

test('pusta lista P2 nie tworzy pustej porcji (inaczej odpalilby sie sceptyk bez findingow)', () => {
  assert.deepEqual(porcjujP2([], 4), [])
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
  assert.match(zrodlo, /const grupyP2 = porcjujP2\(p2DoVerify, MAKS_W_GRUPIE_P2\)/)
  assert.match(zrodlo, /const MAKS_W_GRUPIE_P2 = 4/)
})

test('wiring — grupa, ktorej thunk padl, schodzi do niezweryfikowanej zamiast wyparowac', () => {
  assert.match(
    zrodlo,
    /Array\.isArray\(wynikGrupy\) \? wynikGrupy : grupyP2\[i\]\.map\(\(f\) => domknijWerdykty\(f, \[\]\)\)/,
    'null z parallel() nie moze zabrac ze soba findingow calej grupy'
  )
})

// Zmiana kontraktu (P3, tabela D6): reviewer i sceptyk P1 przypiete na `high` zamiast efortu sesji (null), scribe `low`.
// Zmiana kontraktu (P7): tier `packager` znika razem z agentem kontekst:diff — dossier liczy skrypt, zapasowy agent to haiku bez efortu.
test('wiring — tiery sa wystawione przez args, z tanszym scribe i sceptykiem P2, bez packagera', () => {
  assert.match(zrodlo, /const TIERY_DOMYSLNE = \{ sceptykP2: 'medium', sceptykP1: 'high', reviewer: 'high', scribe: 'low' \}/)
  assert.match(zrodlo, /const tiery = \{ \.\.\.TIERY_DOMYSLNE, \.\.\.\(\(args && args\.tiery\) \|\| \{\}\) \}/)
})

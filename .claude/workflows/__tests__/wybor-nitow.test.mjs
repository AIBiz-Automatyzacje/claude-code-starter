// Test globalnego limitu P3 i dwustopniowego wyboru nitow z dev-docs-review-wf.js.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/wybor-nitow.test.mjs
//   albo caly katalog:  node --test '.claude/workflows/__tests__/*.test.mjs'   (glob w apostrofach)
// Dlaczego ekstrakcja ze zrodla zamiast importu — patrz naglowek bloker-srodowiska.test.mjs.
//
// Kontekst (audyt 2026-09-02, pozycja B1): od decyzji operatora P3 typu KOD/TEST wchodza do petli
// naprawczej, wiec `wybierzNity` przestal ucinac szum, a zaczal ucinac PRACE DO ZROBIENIA. Stad
// dwa stopnie: najpierw nity w plikach, ktore agent fixa i tak otworzy przy P1/P2 tej fazy, potem
// reszta round-robinem po zrodle. Round-robin jest starszy i ma wlasny powod (bez niego `slice`
// systematycznie wyciszal simplicity/test-coverage/e2e) — te testy pilnuja obu wlasnosci naraz.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const PLIK_WORKFLOWU = resolve(KATALOG, '../dev-docs-review-wf.js')
const zrodlo = readFileSync(PLIK_WORKFLOWU, 'utf8')

function wytnijFragment() {
  const start = zrodlo.indexOf('function kluczPliku(')
  assert.notEqual(start, -1, 'nie znaleziono kluczPliku w dev-docs-review-wf.js — kotwica testu wymaga aktualizacji')
  const funkcja = zrodlo.indexOf('function wybierzNity(', start)
  assert.notEqual(funkcja, -1, 'nie znaleziono wybierzNity po kluczPliku')
  const koniec = zrodlo.indexOf('\n}\n', funkcja)
  assert.notEqual(koniec, -1, 'nie znaleziono konca funkcji wybierzNity')
  return zrodlo.slice(start, koniec + 3)
}

// eslint-disable-next-line no-new-func — jedyna droga do niewyeksportowanej jednostki w skrypcie workflowu;
// wejsciem jest plik z tego repo, nie dane uzytkownika.
const { wybierzNity, kluczPliku } = new Function(
  `${wytnijFragment()}\nreturn { wybierzNity, kluczPliku }`
)()

const nit = (zrodloAgenta, plik, typ = 'KOD') => ({ severity: 'P3', typ, plik, opis: `nit w ${plik}`, _zrodlo: zrodloAgenta })

// ── Prog LIMIT_P3_GLOBALNY ─────────────────────────────────────────────────

test('prog globalny P3 wynosi 15 (podniesiony z 8, bo P3 ida teraz do fixa)', () => {
  const m = zrodlo.match(/^const LIMIT_P3_GLOBALNY = (\d+)$/m)
  assert.ok(m, 'nie znaleziono deklaracji LIMIT_P3_GLOBALNY')
  assert.equal(Number(m[1]), 15)
})

// ── kluczPliku ─────────────────────────────────────────────────────────────

test('kluczPliku odcina numer linii, zeby dwa nity w tym samym pliku trafialy w ten sam klucz', () => {
  assert.equal(kluczPliku('src/webhooks/deliver.ts:214'), 'src/webhooks/deliver.ts')
  assert.equal(kluczPliku('src/webhooks/deliver.ts'), 'src/webhooks/deliver.ts')
  assert.equal(kluczPliku('  SRC/Webhooks/Deliver.ts:31  '), 'src/webhooks/deliver.ts')
})

test('kluczPliku na pustym / nieznanym pliku nie wywala sie i nie udaje sciezki', () => {
  assert.equal(kluczPliku('?'), '?')
  assert.equal(kluczPliku(undefined), '')
  assert.equal(kluczPliku(null), '')
})

// ── Stopien 1: nity w plikach findingow waznych ────────────────────────────

test('nity w plikach P1/P2 wchodza przed pozostalymi, gdy limit jest ciasny', () => {
  const lista = [
    nit('security', 'src/obcy-a.ts:10'),
    nit('security', 'src/obcy-b.ts:11'),
    nit('performance', 'src/obcy-c.ts:12'),
    nit('simplicity', 'src/deliver.ts:214'),   // ten plik ma P1
    nit('test-coverage', 'src/worker.ts:132'), // ten plik ma P2
  ]
  const plikiWaznych = new Set(['src/deliver.ts', 'src/worker.ts'])
  const wybrane = wybierzNity(lista, 2, plikiWaznych)
  assert.equal(wybrane.length, 2)
  assert.deepEqual(
    wybrane.map((f) => f.plik).sort(),
    ['src/deliver.ts:214', 'src/worker.ts:132'],
    'przy limicie 2 maja wejsc wylacznie nity z plikow, ktore fix i tak otworzy'
  )
})

test('po wyczerpaniu stopnia 1 dobierane sa pozostale nity, az do limitu', () => {
  const lista = [
    nit('security', 'src/obcy-a.ts:10'),
    nit('performance', 'src/obcy-b.ts:11'),
    nit('architecture', 'src/obcy-c.ts:12'),
    nit('simplicity', 'src/deliver.ts:214'), // jedyny w pliku, ktory ma P1/P2
  ]
  const wybrane = wybierzNity(lista, 3, new Set(['src/deliver.ts']))
  assert.equal(wybrane.length, 3, 'limit ma zostac wypelniony, a nie zatrzymany na stopniu 1')
  assert.equal(wybrane[0].plik, 'src/deliver.ts:214', 'stopien 1 idzie pierwszy')
  assert.ok(
    wybrane.slice(1).every((f) => f.plik.startsWith('src/obcy-')),
    'pozostale dwa miejsca dobierane sa ze stopnia 2'
  )
})

test('lista rowna limitowi wraca bez przetasowania (nic nie tniemy, wiec nie ma czego priorytetyzowac)', () => {
  const lista = [
    nit('security', 'src/obcy-a.ts:10'),
    nit('simplicity', 'src/deliver.ts:214'),
  ]
  assert.deepEqual(wybierzNity(lista, 2, new Set(['src/deliver.ts'])), lista)
})

test('lista krotsza niz limit wraca w calosci, bez przetasowania', () => {
  const lista = [nit('security', 'a.ts:1'), nit('e2e', 'b.ts:2')]
  const wybrane = wybierzNity(lista, 15, new Set())
  assert.deepEqual(wybrane, lista)
})

// ── Stopien 2: round-robin po zrodle (wlasnosc sprzed B1, nie wolno jej zgubic) ──

test('round-robin nie wycisza systematycznie ostatnich reviewerow', () => {
  // Security zglosil 6 nitow, simplicity/test-coverage/e2e po jednym. Proste `slice(0,4)` po kolejnosci
  // wstawiania oddaloby wszystkie cztery miejsca security — dokladnie regresja, przed ktora chroni round-robin.
  const lista = [
    ...Array.from({ length: 6 }, (_, i) => nit('security', `src/sec-${i}.ts:${i}`)),
    nit('simplicity', 'src/simple.ts:1'),
    nit('test-coverage', 'src/cover.ts:2'),
    nit('e2e', 'src/e2e.ts:3'),
  ]
  const wybrane = wybierzNity(lista, 4, new Set())
  assert.equal(wybrane.length, 4)
  assert.deepEqual(
    [...new Set(wybrane.map((f) => f._zrodlo))].sort(),
    ['e2e', 'security', 'simplicity', 'test-coverage'],
    'kazde zrodlo ma dostac po jednym miejscu, zanim ktorekolwiek dostanie drugie'
  )
})

test('w obrebie zrodla KOD i TEST ida przed E2E i OPERATOR', () => {
  const lista = [
    nit('security', 'src/a.ts:1', 'OPERATOR'),
    nit('security', 'src/b.ts:2', 'E2E'),
    nit('security', 'src/c.ts:3', 'TEST'),
    nit('security', 'src/d.ts:4', 'KOD'),
    nit('performance', 'src/e.ts:5', 'KOD'),
  ]
  const wybrane = wybierzNity(lista, 2, new Set())
  assert.deepEqual(
    wybrane.map((f) => f.typ).sort(),
    ['KOD', 'KOD'],
    'pierwsza runda round-robinu bierze z kazdej kolejki jej najwyzszy priorytet typu'
  )
})

test('nity nadwyzkowe w stopniu 1 tez ida round-robinem, a nie blokiem jednego reviewera', () => {
  // Wszystkie nity siedza w plikach P1/P2, wiec caly limit rozstrzyga sie w stopniu 1.
  const lista = [
    ...Array.from({ length: 5 }, (_, i) => nit('security', `src/deliver.ts:${i}`)),
    nit('simplicity', 'src/worker.ts:9'),
  ]
  const wybrane = wybierzNity(lista, 2, new Set(['src/deliver.ts', 'src/worker.ts']))
  assert.deepEqual(
    [...new Set(wybrane.map((f) => f._zrodlo))].sort(),
    ['security', 'simplicity'],
    'stopien 1 nie moze byc furtka do oddania calego limitu jednemu reviewerowi'
  )
})

// ── Kotwica wywolania w workflowie ─────────────────────────────────────────

test('wiring — zbior plikow waznych powstaje z P1/P2 bez typu OPERATOR', () => {
  assert.match(
    zrodlo,
    /const plikiWaznych = new Set\(\s*\n\s*dedup\.filter\(\(f\) => \(f\.severity === 'P1' \|\| f\.severity === 'P2'\) && f\.typ !== 'OPERATOR'\)\.map\(\(f\) => kluczPliku\(f\.plik\)\)\s*\n\s*\)/,
    'stopien 1 ma sie opierac na plikach realnych findingow waznych, nie na findingach OPERATOR'
  )
  assert.match(zrodlo, /const nity = wybierzNity\(wszystkieNity, LIMIT_P3_GLOBALNY, plikiWaznych\)/)
})

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

// kluczPliku jest zalezoscia porcjujP2; domknijWerdykty liczy etykiety w obiekcie z zewnatrz.
const fragment = [
  wytnij('const sceptykLiczniki', '}'),
  wytnij('const NIZSZA_WAGA', '}'),
  wytnij('function kluczPliku(', '\n}'),
  wytnij('function etykietaGlosu(', '\n}'),
  wytnij('function domknijWerdykty(', '\n}'),
  wytnij('function porcjujP2(', '\n}'),
].join('\n')

/** @typedef {import('./typy.mjs').Finding} Finding */
/** @typedef {import('./typy.mjs').Glos} Glos */

// Wyjatek od no-new-func: jedyna droga do niewyeksportowanych jednostek w skrypcie workflowu;
// wejsciem jest plik z tego repo, nie dane uzytkownika.
/** @type {{ domknijWerdykty: (f: Finding, glosy: Glos[]) => Finding & { potwierdzony: boolean, _uzasadnienie?: string }, porcjujP2: (lista: Finding[], maks: number) => Finding[][], liczniki: () => { agree: number, disagree_evidence: number, disagree_concern: number, degradacje: number } }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { domknijWerdykty, porcjujP2, liczniki } = new Function(
  `${fragment}\nreturn { domknijWerdykty, porcjujP2, liczniki: () => ({ ...sceptykLiczniki }) }`
)()

/** @type {(severity: string, plik: string, typ?: string) => Finding} */
const finding = (severity, plik, typ = 'KOD') => ({ severity, typ, plik, opis: `problem w ${plik}`, _zrodlo: 'security' })
/** @type {(etykieta: string, dowod?: string) => Glos} */
const glos = (etykieta, dowod = '') => ({ etykieta, dowod, uzasadnienie: '—' })
const AGREE = 'AGREE'
const EVIDENCE = 'DISAGREE_EVIDENCE'
const CONCERN = 'DISAGREE_CONCERN'

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
// Zmiana kontraktu (P9, sceptyk asymetryczny): etykieta zastepuje `realny` i `severityKorekta`. Regula A7
// (pojedynczy glos nie rusza wagi) nie dotyczy juz P2: DISAGREE_CONCERN z definicji obniza P2 do P3, ale nie kasuje.

test('AGREE utrzymuje finding P2 bez zmian', () => {
  const f = finding('P2', 'src/a.ts:1')
  const wynik = domknijWerdykty(f, [glos(AGREE)])
  assert.equal(wynik.potwierdzony, true)
  assert.equal(wynik.severity, 'P2')
  assert.equal(wynik.opis, f.opis)
})

test('DISAGREE_EVIDENCE z linia albo testem obala finding P2, dowod zostaje w uzasadnieniu', () => {
  const wynik = domknijWerdykty(finding('P2', 'src/a.ts:1'), [glos(EVIDENCE, 'src/a.ts:40 guard')])
  assert.equal(wynik.potwierdzony, false)
  assert.match(wynik._uzasadnienie ?? '', /src\/a\.ts:40 guard/)
})

test('DISAGREE_CONCERN obniza P2 do P3 i nie kasuje — adnotacja w opisie, degradacja policzona', () => {
  const przed = liczniki()
  const wynik = domknijWerdykty(finding('P2', 'src/a.ts:1'), [glos(CONCERN)])
  assert.equal(wynik.potwierdzony, true, 'watpliwosc bez dowodu nie usuwa findingu')
  assert.equal(wynik.severity, 'P3')
  assert.match(wynik.opis, /\[sceptyk: P2 → P3/)
  assert.equal(liczniki().degradacje, przed.degradacje + 1)
  assert.equal(liczniki().disagree_concern, przed.disagree_concern + 1)
})

test('DISAGREE_EVIDENCE bez linii ani testu liczy sie jak CONCERN — obala tylko dowod', () => {
  const przed = liczniki()
  const wynik = domknijWerdykty(finding('P2', 'src/a.ts:1'), [glos(EVIDENCE, '  ')])
  assert.equal(wynik.potwierdzony, true)
  assert.equal(wynik.severity, 'P3')
  assert.equal(liczniki().disagree_evidence, przed.disagree_evidence, 'EVIDENCE bez dowodu nie trafia do licznika obalen')
  assert.equal(liczniki().disagree_concern, przed.disagree_concern + 1)
})

// ── domknijWerdykty: trzy glosy (sciezka P1) ───────────────────────────────

test('P1 przezywa, gdy tylko jeden z trzech sceptykow go obalil dowodem', () => {
  const wynik = domknijWerdykty(finding('P1', 'src/a.ts:1'), [glos(AGREE), glos(EVIDENCE, 'src/a.ts:9'), glos(AGREE)])
  assert.equal(wynik.potwierdzony, true)
  assert.equal(wynik.severity, 'P1')
})

test('P1 pada przy dwoch z trzech obaleniach z dowodem', () => {
  const wynik = domknijWerdykty(finding('P1', 'src/a.ts:1'), [glos(EVIDENCE, 'src/a.ts:9'), glos(EVIDENCE, 'src/a.test.ts:3'), glos(AGREE)])
  assert.equal(wynik.potwierdzony, false)
})

test('P1 spada do P2, gdy dwa z trzech glosow sie nie zgadzaja, ale dowod ma tylko jeden', () => {
  const wynik = domknijWerdykty(finding('P1', 'src/a.ts:1'), [glos(EVIDENCE, 'src/a.ts:9'), glos(CONCERN), glos(AGREE)])
  assert.equal(wynik.potwierdzony, true)
  assert.equal(wynik.severity, 'P2')
  assert.match(wynik.opis, /\[sceptyk: P1 → P2/)
})

test('pojedynczy CONCERN nie rusza P1 (ominalby twardy STOP)', () => {
  const f = finding('P1', 'src/a.ts:1')
  const wynik = domknijWerdykty(f, [glos(CONCERN), glos(AGREE), glos(AGREE)])
  assert.equal(wynik.severity, 'P1')
  assert.equal(wynik.opis, f.opis)
})

test('P1 z dwoma glosami (trzeci sceptyk padl): jedno obalenie to nie wiekszosc', () => {
  const wynik = domknijWerdykty(finding('P1', 'src/a.ts:1'), [glos(EVIDENCE, 'src/a.ts:9'), glos(AGREE)])
  assert.equal(wynik.potwierdzony, true)
  assert.equal(wynik.severity, 'P1')
})

test('liczniki etykiet licza glosy, nie findingi', () => {
  const przed = liczniki()
  domknijWerdykty(finding('P1', 'src/a.ts:1'), [glos(AGREE), glos(AGREE), glos(CONCERN)])
  assert.equal(liczniki().agree, przed.agree + 2)
  assert.equal(liczniki().disagree_concern, przed.disagree_concern + 1)
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

// ── Strazniki sceptyka asymetrycznego (P9, §2 pkt 7) ─────────────────────────

/** @type {(f: Finding) => string} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const zarzutSceptyka = new Function(`${wytnij('function zarzutSceptyka(', '\n}')}\nreturn zarzutSceptyka`)()

test('zarzut dla sceptyka = waga, plik:linia i teza — bez autora, osi i typu', () => {
  const tekst = zarzutSceptyka({ severity: 'P2', typ: 'KOD', plik: 'src/a.ts:12', opis: 'brak obslugi bledu', _zrodlo: 'security' })
  assert.equal(tekst, '[P2] src/a.ts:12 — brak obslugi bledu')
})

test('polecenia sceptykow buduja zarzut wylacznie przez zarzutSceptyka (straznik: bez uzasadnienia autora)', () => {
  const verify = wytnij('const skepsaBlok', '\nconst p2Zweryfikowane')
  assert.doesNotMatch(verify, /f\._zrodlo|f\.typ|_uzasadnienie|\$\{f\.opis\}/, 'sceptyk nie dostaje autora, osi ani surowego opisu obok zarzutu')
  assert.equal((verify.match(/zarzutSceptyka\(f\)/g) || []).length, 2, 'P1 i porcja P2 skladaja zarzut ta sama funkcja')
  assert.match(verify, /AGREE[\s\S]*DISAGREE_EVIDENCE[\s\S]*DISAGREE_CONCERN/, 'polecenie wymienia trzy etykiety')
})

test('schematy werdyktow: trzy etykiety i dowod, bez realny i severityKorekta', () => {
  const schematy = wytnij('const ETYKIETA_SCEPTYKA', "required: ['werdykty'],")
  assert.match(schematy, /enum: \['AGREE', 'DISAGREE_EVIDENCE', 'DISAGREE_CONCERN'\]/)
  assert.doesNotMatch(schematy, /realny|severityKorekta/)
  assert.match(schematy, /required: \['etykieta', 'dowod', 'uzasadnienie'\]/)
  assert.match(schematy, /required: \['indeks', 'etykieta', 'dowod', 'uzasadnienie'\]/)
})

test('wiring — E2E testera i OPERATOR dalej poza verify', () => {
  assert.match(zrodlo, /const doWeryfikacji = dedup\.filter\(\(f\) => \(f\.severity === 'P1' \|\| f\.severity === 'P2'\) && f\.typ !== 'OPERATOR' && !zE2eTestera\(f\)\)/)
})

// Zmiana kontraktu (P3, tabela D6): reviewer i sceptyk P1 przypiete na `high` zamiast efortu sesji (null), scribe `low`.
// Zmiana kontraktu (P7): tier `packager` znika razem z agentem kontekst:diff — dossier liczy skrypt, zapasowy agent to haiku bez efortu.
test('wiring — tiery sa wystawione przez args, z tanszym scribe i sceptykiem P2, bez packagera', () => {
  assert.match(zrodlo, /const TIERY_DOMYSLNE = \{ sceptykP2: 'medium', sceptykP1: 'high', reviewer: 'high', scribe: 'low' \}/)
  assert.match(zrodlo, /const tiery = \{ \.\.\.TIERY_DOMYSLNE, \.\.\.\(\(args && args\.tiery\) \|\| \{\}\) \}/)
})

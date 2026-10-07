// Test detekcji awarii srodowiska E2E w trakcie runu z dev-docs-review-wf.js.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/bloker-srodowiska.test.mjs
//   albo caly katalog:  node --test '.claude/workflows/__tests__/*.test.mjs'   (glob w apostrofach)
// UWAGA: `node --test .claude/workflows/__tests__/` (sama sciezka katalogu) NIE dziala — automatyczne
// wyszukiwanie testow pomija katalogi ukryte, a caly `.claude` jest ukryty. Node probuje wtedy zaladowac
// katalog jako modul i wywala MODULE_NOT_FOUND. Uzywaj jednej z dwoch form powyzej.
//
// DLACZEGO EKSTRAKCJA ZE ZRODLA, A NIE IMPORT: workflowy sa self-contained skryptami runtime'u Workflow —
// maja top-level `await agent(...)`, `phase()`, `log()`, ktorych w Node nie ma, wiec `import()` tego pliku
// wysypuje sie na ReferenceError. Wyciagniecie z pliku SYGNATUR i funkcji utrzymuje JEDNO zrodlo prawdy.
//
// P14 (zmiana kontraktu): awaria srodowiska = przebieg testera SKIP z przyczyna `srodowisko` (pole strukturalne). Sygnatura
// tekstu tylko nazywa klase awarii. Powody: `curl -s` nie wypisuje komunikatu, curl 8 pisze „Couldn't connect to server”
// (poza sygnaturami), a FAIL z „connection refused” po sprawdzeniu `e2e.mjs stan` znaczy „kod fazy polozyl serwer” — to defekt
// do fixa (fix restartuje serwer), nie awaria srodowiska. Findingi (takze z sygnatura, audyt A1: `dns.lookup`/`getaddrinfo`
// w opisie defektu kodu) nie sa juz wejsciem detekcji. Skutek detekcji: scenariusze na [Manual], reszta runu bez przegladarki.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const PLIK_WORKFLOWU = resolve(KATALOG, '../dev-docs-review-wf.js')
const zrodlo = readFileSync(PLIK_WORKFLOWU, 'utf8')

// ── Ekstrakcja jednostki testowanej ────────────────────────────────────────

function wytnijFragment() {
  const start = zrodlo.indexOf('const SYGNATURY_BLOKERA = [')
  assert.notEqual(start, -1, 'nie znaleziono SYGNATURY_BLOKERA w dev-docs-review-wf.js — kotwica testu wymaga aktualizacji')
  const funkcja = zrodlo.indexOf('function wykryjBlokerSrodowiska(', start)
  assert.notEqual(funkcja, -1, 'nie znaleziono wykryjBlokerSrodowiska po SYGNATURY_BLOKERA')
  const koniec = zrodlo.indexOf('\n}\n', funkcja)
  assert.notEqual(koniec, -1, 'nie znaleziono konca funkcji wykryjBlokerSrodowiska')
  return zrodlo.slice(start, koniec + 3)
}

/** @typedef {import('./typy.mjs').PrzebiegE2e} PrzebiegE2e */

// Wyjatek od no-new-func: jedyna droga do niewyeksportowanej jednostki w skrypcie workflowu;
// wejsciem jest plik z tego repo, nie dane uzytkownika.
/** @type {{ wykryjBlokerSrodowiska: (przebiegiTestera: PrzebiegE2e[]) => { wykryty: boolean, klasa: string, dowod: string } | null }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { wykryjBlokerSrodowiska } = new Function(
  `${wytnijFragment()}\nreturn { wykryjBlokerSrodowiska }`
)()

// Odwzorowanie miejsca wywolania z workflowu (filtr trybu nie jest w samej funkcji); test `wiring` pilnuje wywolania.
/** @param {{ przebiegi: PrzebiegE2e[], e2eTryb: string }} wejscie */
function wykryjJakWorkflow({ przebiegi, e2eTryb }) {
  if (e2eTryb !== 'przegladarka') return null
  return wykryjBlokerSrodowiska(przebiegi)
}

/** @type {(dowod: string, przyczyna?: string, wynik?: string) => PrzebiegE2e[]} */
const przebieg = (dowod, przyczyna = 'srodowisko', wynik = 'SKIP') => [{ checkbox: 'Test: [E2E] `logowanie` — /login → panel', flow: 'logowanie', wynik, przyczyna, dowod }]

// ── POZYTYWNE — SKIP `srodowisko`; realny komunikat runtime nazywa klase ─────

const POZYTYWNE = [
  { nazwa: 'przegladarka: ERR_CONNECTION_REFUSED na dev serwerze', dowod: 'Scenariusz przerwany: net::ERR_CONNECTION_REFUSED przy otwieraniu http://localhost:5173/oferty', klasa: 'dev-server-nieosiagalny' },
  { nazwa: 'node: ECONNREFUSED z adresem i portem', dowod: 'Preflight padl: Error: connect ECONNREFUSED 127.0.0.1:5173', klasa: 'dev-server-nieosiagalny' },
  { nazwa: 'curl -sS: Connection refused', dowod: 'curl: (7) Failed to connect to localhost port 5173 after 3 ms: Connection refused', klasa: 'dev-server-nieosiagalny' },
  { nazwa: 'przegladarka: ERR_NAME_NOT_RESOLVED na hoscie Supabase', dowod: 'net::ERR_NAME_NOT_RESOLVED przy zadaniu do https://abcdefgh.supabase.co/auth/v1/token', klasa: 'host-nierozwiazywalny' },
  { nazwa: 'node: getaddrinfo ENOTFOUND (kod bledu zlaczony z wywolaniem)', dowod: 'Logowanie padlo: getaddrinfo ENOTFOUND abcdefgh.supabase.co', klasa: 'host-nierozwiazywalny' },
  { nazwa: 'curl: Could not resolve host', dowod: 'curl: (6) Could not resolve host: abcdefgh.supabase.co', klasa: 'host-nierozwiazywalny' },
  { nazwa: 'curl -s milczy — sam powod testera', dowod: 'aplikacja nie odpowiada na http://localhost:5173 (curl -s bez wyjscia, kod 7)', klasa: 'srodowisko' },
]

for (const p of POZYTYWNE) {
  test(`awaria srodowiska WYKRYTA — ${p.nazwa}`, () => {
    const wynik = wykryjJakWorkflow({ przebiegi: przebieg(p.dowod), e2eTryb: 'przegladarka' })
    assert.ok(wynik, 'SKIP z przyczyna srodowisko to awaria srodowiska')
    assert.equal(wynik.klasa, p.klasa)
    assert.ok(wynik.dowod.length > 0, 'dowod idzie do logu runu — nie moze byc pusty')
  })
}

// ── NEGATYWNE ────────────────────────────────────────────────────────────────

test('NIE wykryta — FAIL z ERR_CONNECTION_REFUSED (kod fazy polozyl serwer: finding do fixa, fix restartuje serwer)', () => {
  assert.equal(wykryjJakWorkflow({ przebiegi: przebieg('net::ERR_CONNECTION_REFUSED http://localhost:5173/', 'nie-dotyczy', 'FAIL'), e2eTryb: 'przegladarka' }), null)
})

test('NIE wykryta — SKIP harness albo limit z cytowanym bledem sieci uslugi zewnetrznej', () => {
  assert.equal(wykryjJakWorkflow({ przebiegi: przebieg('popup OAuth: net::ERR_NAME_NOT_RESOLVED accounts.google.com', 'harness'), e2eTryb: 'przegladarka' }), null)
  assert.equal(wykryjJakWorkflow({ przebiegi: przebieg('SMTP: connect ECONNREFUSED smtp.example.com:587', 'limit-zewnetrzny'), e2eTryb: 'przegladarka' }), null)
})

test('NIE wykryta — SKIP brak-seeda (defekt buildera, idzie do fixa)', () => {
  assert.equal(wykryjJakWorkflow({ przebiegi: przebieg('brak e2e/seeds/logowanie-seed.sql', 'brak-seeda'), e2eTryb: 'przegladarka' }), null)
})

test('NIE wykryta — tester bez przebiegow albo same PASS', () => {
  assert.equal(wykryjJakWorkflow({ przebiegi: [], e2eTryb: 'przegladarka' }), null)
  assert.equal(wykryjJakWorkflow({ przebiegi: przebieg('ok', 'nie-dotyczy', 'PASS'), e2eTryb: 'przegladarka' }), null)
})

test('NIE wykryta — tryb bez-przegladarki (SKIP srodowisko jest wtedy oczekiwany)', () => {
  assert.equal(wykryjJakWorkflow({ przebiegi: przebieg('srodowisko E2E niedostepne w tym runie'), e2eTryb: 'bez-przegladarki' }), null)
})

// ── Kotwica wywolania w workflowie ─────────────────────────────────────────

test('wiring — detekcja tylko w trybie przegladarki, na przebiegach testera', () => {
  assert.match(
    zrodlo,
    /const blokerSrodowiska = e2eTryb === 'przegladarka'\s*\n\s*\? wykryjBlokerSrodowiska\(e2ePrzebiegi\)\s*\n\s*: null/,
    'detekcja dostaje przebiegi testera i dziala tylko w trybie przegladarki',
  )
})

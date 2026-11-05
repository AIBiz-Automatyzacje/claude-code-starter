// Kontrakt adaptera E2E (plan szablonu mobile z rdzenia, IU-1.3). `adapter.mjs` to slot plikowy: nakładka stacku podmienia
// go w całości, a rdzeń (srodowisko.mjs, start.mjs, plan/gotowosc.mjs, doctor) woła tylko eksporty z kontraktu. Test nie
// sprawdza wartości stacku — przechodzi na każdym wariancie adaptera; treść web pilnuje stacks/__tests__/sloty.test.mjs.
//
// Uruchomienie: node --test .claude/scripts/e2e/__tests__/adapter.test.mjs

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import * as adapter from '../adapter.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const SKRYPTY = resolve(KATALOG, '..', '..')
/** @param {string} sciezka wzgledem .claude/scripts */
const czytaj = (sciezka) => readFileSync(join(SKRYPTY, sciezka), 'utf8')

test('adapter: stałe portów i komenda startu', () => {
  assert.ok(Number.isInteger(adapter.DOMYSLNY_PORT) && adapter.DOMYSLNY_PORT > 0)
  assert.ok(adapter.PORT_DEV === null || Number.isInteger(adapter.PORT_DEV))
  assert.notEqual(adapter.PORT_DEV, adapter.DOMYSLNY_PORT, 'domyślny port E2E nie może być portem serwera deweloperskiego')
  assert.equal(typeof adapter.OPIS_PORTU_DEV, 'string')
  const start = adapter.komendaStartu('pnpm', 4321)
  assert.equal(typeof start, 'string')
  assert.match(start, /\b4321\b/, 'komenda startu stawia serwer na porcie z E2E_URL')
  assert.match(adapter.SCIEZKA_ZDROWIA, /^(\/.*)?$/)
})

test('adapter: kroki stacku wokół serwera i uwaga doctora; repo bez plików stacku nic nie dostaje', async () => {
  const pusty = mkdtempSync(join(tmpdir(), 'adapter-'))
  try {
    assert.deepEqual(adapter.przedStartem(pusty, {}), { ok: true, detal: '', naprawa: '' })
    assert.deepEqual(await adapter.poStarcie(pusty, {}, { port: 1 }), { ok: true, detal: '', naprawa: '' })
    assert.deepEqual(adapter.poZatrzymaniu(pusty), { detal: '' })
    assert.equal(adapter.uwagaDoctora(pusty), null)
  } finally {
    rmSync(pusty, { recursive: true, force: true })
  }
})

test('adapter: narzędzie jazdy testera z instalacją i diagnozą', () => {
  const { nazwa, instalacja, diagnoza } = adapter.NARZEDZIE_JAZDY
  for (const pole of [nazwa, instalacja, diagnoza]) assert.ok(typeof pole === 'string' && pole.length > 0)
  assert.match(nazwa, /^[\w.-]+$/, 'nazwa = komenda w PATH (doctor szuka jej przez command -v)')
  assert.equal(typeof adapter.sprawdzNarzedzie, 'function')
  assert.equal(typeof adapter.probnyZrzut, 'function')
  assert.ok(Number.isInteger(adapter.LIMIT_ZRZUTU_SEK) && adapter.LIMIT_ZRZUTU_SEK > 0)
  assert.equal(typeof adapter.opisProbyZrzutu, 'string')
  assert.equal(typeof adapter.naprawaZrzutu, 'string')
})

// Polityki stacku (IU-1.8): obcy proces na porcie E2E (D11) i bloker środowiska w trakcie runu (D12).
test('adapter: polityka obcego procesu na porcie E2E — stop albo zastap', () => {
  assert.ok(['stop', 'zastap'].includes(adapter.POLITYKA_OBCEGO), String(adapter.POLITYKA_OBCEGO))
})

test('adapter: sygnatury blokera środowiska stacku — wzorzec, klasa, polityka, naprawa przy stop-rebuild; dane JSON', () => {
  assert.ok(Array.isArray(adapter.SYGNATURY_BLOKERA))
  for (const s of adapter.SYGNATURY_BLOKERA) {
    assert.deepEqual(Object.keys(s).sort(), ['flagi', 'klasa', 'naprawa', 'polityka', 'wzorzec'], JSON.stringify(s))
    assert.doesNotThrow(() => new RegExp(s.wzorzec, s.flagi))
    assert.match(s.klasa, /^[a-z0-9-]+$/)
    assert.ok(['manual-restart', 'stop-rebuild'].includes(s.polityka), s.polityka)
    assert.equal(typeof s.naprawa, 'string')
    if (s.polityka === 'stop-rebuild') assert.ok(s.naprawa.trim().length > 0, `${s.klasa}: STOP bez naprawy`)
  }
  assert.deepEqual(JSON.parse(JSON.stringify(adapter.SYGNATURY_BLOKERA)), adapter.SYGNATURY_BLOKERA, 'sygnatury przechodza przez JSON restartu')
})

test('adapter: uwagi planowania to lista napisów; projekt bez plików stacku nie dostaje uwag', () => {
  const pusty = mkdtempSync(join(tmpdir(), 'adapter-'))
  try {
    const uwagi = adapter.uwagiPlanowania(pusty, {})
    assert.ok(Array.isArray(uwagi))
    assert.deepEqual(uwagi, [])
  } finally {
    rmSync(pusty, { recursive: true, force: true })
  }
})

/** Kod bez komentarzy liniowych i blokowych JSDoc — historia vibersi w komentarzach nie jest zachowaniem. */
const kod = (/** @type {string} */ t) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*(\/\/|#)/.test(l)).join('\n')
// Bez słowa „Vite”: strażnik bazy dev w srodowisko.mjs (klucze VITE_*, kolejność plików env) przechodzi do profil.json
// stacku w IU-1.7 razem z pozostałymi kluczami env.
const SLOWA_STACKU = ['agent-browser', 'agentBrowser', 'vite.config', 'PLIKI_VITE', '5173', '5174', '--mode e2e']

test('rdzeń E2E, bramka gotowości i doctor nie znają narzędzia jazdy ani serwera stacku — biorą je z adaptera', () => {
  for (const plik of ['e2e/srodowisko.mjs', 'e2e/start.mjs', 'plan/gotowosc.mjs', 'doctor/port-e2e.mjs', 'doctor/doctor.sh', 'doctor/narzedzie-jazdy.mjs']) {
    const t = kod(czytaj(plik))
    assert.deepEqual(SLOWA_STACKU.filter((s) => t.includes(s)), [], `${plik}: słowa stacku poza adapterem`)
  }
  assert.match(czytaj('e2e/srodowisko.mjs'), /from '\.\/adapter\.mjs'/)
  assert.match(czytaj('plan/gotowosc.mjs'), /uwagiPlanowania\(projekt, env\)/)
})

test('doctor: wiersz narzędzia jazdy ze skryptu czytającego adapter', () => {
  const wynik = spawnSync(process.execPath, [join(SKRYPTY, 'doctor/narzedzie-jazdy.mjs'), '--nie-dotyczy', 'brak checkboxów [E2E] w docs/'], { encoding: 'utf8' })
  assert.equal(wynik.status, 0, wynik.stderr)
  assert.deepEqual(wynik.stdout.trimEnd().split('\t'), [adapter.NARZEDZIE_JAZDY.nazwa, 'nie dotyczy', 'brak checkboxów [E2E] w docs/', '—'])
})

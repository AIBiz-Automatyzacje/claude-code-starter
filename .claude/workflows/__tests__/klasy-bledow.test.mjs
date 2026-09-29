// Test zamknietego slownika klas uwag bota w dev-pr-wf.js (It. 1, krok 8; L12, PANEL-WYNIK §4a C).
// Dlaczego: 574 historyczne uwagi mialy 109 nazw klas od trzech klasyfikatorow (ta sama wada pod 3 nazwami) — miara jakosci
// „P1/P2 bota na 100 plikow per klasa i os” byla nieporownywalna. Slownik: docs/reviews/2026-09-19-analiza-pipeline/dane/
// it1-slownik-klas.{txt,json} (po review subagenta, it1-slownik-klas-review.txt).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/klasy-bledow.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-pr-wf.js'), 'utf8')

/** @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca dla "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

/**
 * @typedef {{ enum?: string[], type?: unknown, properties?: Record<string, Schemat>, items?: Schemat, required?: string[] }} Schemat
 */
/** @type {{ KLASY_BLEDOW: Record<string, { os: string, opis: string }>, OSIE_UWAG: string[], WAGI_UWAG: string[], ZEBRANE: Schemat }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { KLASY_BLEDOW, OSIE_UWAG, WAGI_UWAG, ZEBRANE } = new Function(`
  const KLASY = ['napraw', 'napraw-szerzej', 'odrzuc', 'do-operatora']
  ${wytnij('const KLASY_BLEDOW = {', '\n}')}
  ${wytnij('const OSIE_UWAG = [', ']')}
  ${wytnij('const WAGI_UWAG = [', ']')}
  ${wytnij('const ZEBRANE = {', '\n}')}
  return { KLASY_BLEDOW, OSIE_UWAG, WAGI_UWAG, ZEBRANE }`)()

const watek = ZEBRANE.properties?.watki?.items

test('slownik zamkniety: 25–35 klas + inna, kazda z osia ze znanej listy i opisem', () => {
  const klasy = Object.keys(KLASY_BLEDOW)
  assert.ok(klasy.includes('inna'))
  assert.ok(klasy.length - 1 >= 25 && klasy.length - 1 <= 35, `${klasy.length - 1} klas bez inna`)
  for (const [k, v] of Object.entries(KLASY_BLEDOW)) {
    assert.ok(OSIE_UWAG.includes(v.os), `${k}: os ${v.os} spoza listy`)
    assert.ok(v.opis.length >= 20, `${k}: opis za krotki na 5-sekundowa decyzje`)
  }
})

test('schemat watku: klasaBledu to enum slownika, os i waga to enumy, wszystkie wymagane', () => {
  assert.deepEqual(watek?.properties?.klasaBledu?.enum, Object.keys(KLASY_BLEDOW))
  assert.deepEqual(watek?.properties?.os?.enum, OSIE_UWAG)
  assert.deepEqual(watek?.properties?.waga?.enum, WAGI_UWAG)
  for (const pole of ['klasaBledu', 'os', 'waga']) assert.ok(watek?.required?.includes(pole), `${pole} nie jest wymagane`)
})

test('decyzja (napraw/odrzuc) zostaje niezaleznym polem — klasa bledu jej nie zastepuje', () => {
  assert.deepEqual(watek?.properties?.klasa?.enum, ['napraw', 'napraw-szerzej', 'odrzuc', 'do-operatora'])
})

test('tura niesie numer PR i liczbe plikow PR (mianownik miary „na 100 plikow”)', () => {
  assert.ok(ZEBRANE.properties?.plikiPr)
  assert.ok(ZEBRANE.properties?.prNumer)
  assert.ok(ZEBRANE.required?.includes('plikiPr'))
  assert.match(wytnij("if (etap === 'zbierz') {", "\n}\n"), /return \{[^}]*plikiPr: wynik\.plikiPr[^}]*prNumer: wynik\.prNumer/)
})

test('prompt etapu zbierz wymienia kazda klase slownika (agent nie zgaduje nazw)', () => {
  assert.match(wytnij("if (etap === 'zbierz') {", "\n}\n"), /Object\.entries\(KLASY_BLEDOW\)/)
})

// Kopia slownika klas z dev-pr-wf.js (PLAN-POPRAWY P10): node nie zaimportuje workflowu, wiec wiedza trzyma kopie,
// a ten test pilnuje rownosci z KLASY_BLEDOW i KLASY_NIE_DEFEKT wycietymi ze zrodla workflowu.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { KLASY_BLEDOW, KLASY_NIE_DEFEKT, KLASY_WIEDZY } from '../klasy.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../../../workflows/dev-pr-wf.js'), 'utf8')

/** @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  return zrodlo.slice(start, zrodlo.indexOf(koniec, start) + koniec.length)
}

/** @type {{ wf: Record<string, { os: string, opis: string }>, nieDefekt: string[] }} */
// eslint-disable-next-line no-new-func -- ekstrakcja stalych z pliku workflowu tego repo, nie z inputu
const { wf, nieDefekt } = new Function(`
  ${wytnij('const KLASY_BLEDOW = {', '\n}')}
  ${wytnij('const KLASY_NIE_DEFEKT = [', ']')}
  return { wf: KLASY_BLEDOW, nieDefekt: KLASY_NIE_DEFEKT }`)()

test('KLASY_BLEDOW i KLASY_NIE_DEFEKT: kopia rowna slownikowi z dev-pr-wf.js (klucze, osie, opisy)', () => {
  assert.deepEqual(KLASY_BLEDOW, wf)
  assert.deepEqual(KLASY_NIE_DEFEKT, nieDefekt)
})

test('KLASY_WIEDZY: klasy defektow bez nie-defektow i bez „inna” (slownik zamkniety)', () => {
  assert.ok(KLASY_WIEDZY.includes('sciezka-bledu'))
  for (const k of [...KLASY_NIE_DEFEKT, 'inna']) assert.ok(!KLASY_WIEDZY.includes(k), k)
  assert.equal(KLASY_WIEDZY.length, Object.keys(wf).length - nieDefekt.length - 1)
})

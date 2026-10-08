// Funkcja progu ogrodnika (decyzja o agencie oceny) i wybor poprzedniego pomiaru z rekordow telemetrii.

import test from 'node:test'
import assert from 'node:assert/strict'

import { CO_ILE_POMIAROW, PROG_PRZYROSTU, decyzjaOceny, poprzedniPomiar } from '../prog.mjs'

const ZERO = { wyciszenia: 0, any: 0, rzutowania: 0, komentarze: 0, pusty_catch: 0 }
/** @param {Partial<typeof ZERO>} z */
const liczby = (z = {}) => ({ ...ZERO, ...z })
/** @param {Partial<typeof ZERO>} z @param {number} [bez] */
const poprzedni = (z = {}, bez = 1) => ({ run: 'wf_a', start: '2026-10-01T10:00:00.000Z', liczby: liczby(z), bez_oceny: bez })

test('pierwszy pomiar bez przyrostu w diffie: bez oceny, licznik 1, zrodlo diff', () => {
  const d = decyzjaOceny({ liczby: liczby({ any: 40, wyciszenia: 9 }), noweLiczby: liczby(), poprzedni: null })
  assert.equal(d.ocena, false)
  assert.equal(d.zrodlo, 'diff')
  assert.equal(d.bez_oceny, 1)
  assert.deepEqual(d.przyrost, ZERO, 'stan zastany projektu nie jest przyrostem zadania')
})

test('pierwszy pomiar: przyrost z linii dodanych przez zadanie', () => {
  const d = decyzjaOceny({ liczby: liczby({ wyciszenia: 9 }), noweLiczby: liczby({ wyciszenia: 1 }), poprzedni: null })
  assert.equal(d.ocena, true)
  assert.match(d.powod, /nowe wyciszenia lint\/TS: \+1 w liniach dodanych przez zadanie/)
})

test('jedno nowe wyciszenie wzgledem poprzedniego rekordu wlacza ocene', () => {
  const d = decyzjaOceny({ liczby: liczby({ wyciszenia: 4 }), noweLiczby: liczby(), poprzedni: poprzedni({ wyciszenia: 3 }) })
  assert.equal(d.ocena, true)
  assert.equal(d.zrodlo, 'telemetria')
  assert.equal(d.przyrost.wyciszenia, 1)
})

test('prog sumy pozostalych kategorii: 4 = bez oceny, 5 = ocena; spadek nie kompensuje wzrostu', () => {
  const bazowe = poprzedni({ any: 10, rzutowania: 10, komentarze: 10 })
  const ponizej = decyzjaOceny({ liczby: liczby({ any: 12, rzutowania: 12, komentarze: 10 }), noweLiczby: liczby(), poprzedni: bazowe })
  assert.equal(ponizej.ocena, false)
  const prog = decyzjaOceny({ liczby: liczby({ any: 13, rzutowania: 12, komentarze: 0 }), noweLiczby: liczby(), poprzedni: bazowe })
  assert.equal(PROG_PRZYROSTU, 5)
  assert.equal(prog.ocena, true, 'spadek komentarzy o 10 nie znosi wzrostu any i rzutowan o 5')
  assert.match(prog.powod, /przyrost pozostalych kategorii: \+5/)
})

test('spadek wyciszen nie wlacza oceny', () => {
  const d = decyzjaOceny({ liczby: liczby({ wyciszenia: 1 }), noweLiczby: liczby(), poprzedni: poprzedni({ wyciszenia: 3 }) })
  assert.equal(d.ocena, false)
  assert.equal(d.przyrost.wyciszenia, -2)
})

test('przeglad okresowy: co N pomiarow bez oceny', () => {
  assert.equal(CO_ILE_POMIAROW, 5)
  const przed = decyzjaOceny({ liczby: liczby(), noweLiczby: liczby(), poprzedni: poprzedni({}, CO_ILE_POMIAROW - 2) })
  assert.deepEqual([przed.ocena, przed.bez_oceny], [false, CO_ILE_POMIAROW - 1])
  const teraz = decyzjaOceny({ liczby: liczby(), noweLiczby: liczby(), poprzedni: poprzedni({}, CO_ILE_POMIAROW - 1) })
  assert.deepEqual([teraz.ocena, teraz.bez_oceny], [true, CO_ILE_POMIAROW])
  assert.match(teraz.powod, /przeglad okresowy: 5 pomiarow bez oceny/)
})

test('poprzedni pomiar: ten projekt, run autopilota z kompletem liczb, najnowszy po starcie', () => {
  const rekord = (/** @type {Record<string, unknown>} */ r) => ({ typ: 'run', workflow: 'dev-autopilot', projekt: 'oferty', ...r })
  const rekordy = [
    rekord({ run: 'stary', start: '2026-10-01T00:00:00Z', ogrod: { liczby: liczby({ any: 1 }), bez_oceny: 2 } }),
    rekord({ run: 'nowy', start: '2026-10-03T00:00:00Z', ogrod: { liczby: liczby({ any: 3 }), bez_oceny: 0 } }),
    rekord({ run: 'srodkowy', start: '2026-10-02T00:00:00Z', ogrod: { liczby: liczby({ any: 2 }), bez_oceny: 4 } }),
    rekord({ run: 'bez-ogrodu', start: '2026-10-05T00:00:00Z', ogrod: null }),
    rekord({ run: 'niekompletny', start: '2026-10-06T00:00:00Z', ogrod: { liczby: { any: 1 } } }),
    rekord({ run: 'inny-projekt', projekt: 'gramy', start: '2026-10-07T00:00:00Z', ogrod: { liczby: liczby() } }),
    rekord({ run: 'inny-workflow', workflow: 'dev-pr', start: '2026-10-07T00:00:00Z', ogrod: { liczby: liczby() } }),
    { typ: 'faza', projekt: 'oferty', start: '2026-10-08T00:00:00Z', ogrod: { liczby: liczby() } },
  ]
  const p = poprzedniPomiar(rekordy, 'oferty')
  assert.deepEqual(p, { run: 'nowy', start: '2026-10-03T00:00:00Z', liczby: liczby({ any: 3 }), bez_oceny: 0 })
  assert.equal(poprzedniPomiar(rekordy, 'brak'), null)
})

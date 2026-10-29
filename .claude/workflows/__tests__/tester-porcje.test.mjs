// Porcje testera E2E w dev-docs-review-wf.js (HANDOFF 6a pkt 111): vibersi 6b ma faze „przejscie calego MVP” z 55
// scenariuszami [E2E], a jeden tester odgrywal dotad najwyzej 6 (57 tur, ~100k kontekstu). Powyzej progu scenariusze
// ida do kolejnych testerow po kolei (wspolna baza e2e, seedy, limiter), kazda porcja z jednym retry.
// Dlaczego ekstrakcja ze zrodla zamiast importu — patrz naglowek bloker-srodowiska.test.mjs.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')
const tester = readFileSync(resolve(KATALOG, '../../agents/feature-tester-e2e.md'), 'utf8')

/** @param {string} od @param {string} doMarkera */
function wytnij(od, doMarkera) {
  const start = zrodlo.indexOf(od)
  assert.notEqual(start, -1, `nie znaleziono "${od}" — kotwica testu wymaga aktualizacji`)
  const koniec = zrodlo.indexOf(doMarkera, start)
  assert.notEqual(koniec, -1, `nie znaleziono konca dla "${od}"`)
  return zrodlo.slice(start, koniec + doMarkera.length)
}

/** @typedef {{ nr: number, z: number, od: number, do: number }} Porcja */
/** @typedef {{ findings: unknown[], przebiegi: Array<{ flow: string, wynik: string, przyczyna: string }> } | null} Wynik */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const jednostki = new Function(`${wytnij('const MAKS_SCENARIUSZY_TESTERA', '\n')}
${wytnij('function porcjeScenariuszy(', '\n}')}
${wytnij('async function testerPorcjami(', '\n}')}
return { MAKS_SCENARIUSZY_TESTERA, porcjeScenariuszy, testerPorcjami }`)()
/** @type {{ MAKS_SCENARIUSZY_TESTERA: number, porcjeScenariuszy: (liczba: number, maks: number) => Porcja[], testerPorcjami: (porcje: Porcja[], uruchom: (p: Porcja, retry: boolean) => Promise<Wynik>) => Promise<{ wynik: Wynik, porcje: Array<Porcja & { retry: boolean, przebiegi: number | null, przerwana: boolean }> }> }} */
const { MAKS_SCENARIUSZY_TESTERA, porcjeScenariuszy, testerPorcjami } = jednostki

/** @param {number} od @param {number} doNr @param {string} [wynik] @param {string} [przyczyna] */
const przebiegi = (od, doNr, wynik = 'PASS', przyczyna = 'nie-dotyczy') =>
  Array.from({ length: doNr - od + 1 }, (_, i) => ({ flow: `f${od + i}`, wynik, przyczyna }))

test('porcje: 55 scenariuszy przy progu 10 -> 6 porcji 9/9/9/9/9/10 bez dziur i nakladek; prog 10', () => {
  assert.equal(MAKS_SCENARIUSZY_TESTERA, 10)
  const p = porcjeScenariuszy(55, 10)
  assert.deepEqual(p.map((x) => [x.nr, x.z, x.od, x.do]), [[1, 6, 1, 9], [2, 6, 10, 18], [3, 6, 19, 27], [4, 6, 28, 36], [5, 6, 37, 45], [6, 6, 46, 55]])
  assert.deepEqual(porcjeScenariuszy(11, 10).map((x) => [x.od, x.do]), [[1, 5], [6, 11]])
  assert.deepEqual(porcjeScenariuszy(10, 10).map((x) => [x.od, x.do]), [[1, 10]])
})

test('tester porcjami: po kolei, sklejone findingi i przebiegi; retry tylko porcji bez przebiegow', async () => {
  const porcje = porcjeScenariuszy(25, 10)
  /** @type {string[]} */
  const wywolania = []
  const { wynik, porcje: stan } = await testerPorcjami(porcje, async (p, retry) => {
    wywolania.push(`${p.nr}${retry ? 'r' : ''}`)
    if (p.nr === 2 && !retry) return null
    return { findings: [{ porcja: p.nr }], przebiegi: przebiegi(p.od, p.do) }
  })
  assert.deepEqual(wywolania, ['1', '2', '2r', '3'])
  assert.equal(wynik?.przebiegi.length, 25)
  assert.deepEqual(wynik?.findings, [{ porcja: 1 }, { porcja: 2 }, { porcja: 3 }])
  assert.deepEqual(stan.map((s) => [s.nr, s.retry, s.przebiegi, s.przerwana]), [[1, false, 8, false], [2, true, 8, false], [3, false, 9, false]])
})

test('tester porcjami: porcja bez przebiegow po retry zostaje bez wpisow, reszta idzie; wszystkie puste = null', async () => {
  const porcje = porcjeScenariuszy(20, 10)
  const { wynik, porcje: stan } = await testerPorcjami(porcje, async (p) => (p.nr === 1 ? { findings: [], przebiegi: [] } : { findings: [], przebiegi: przebiegi(p.od, p.do) }))
  assert.equal(wynik?.przebiegi.length, 10)
  assert.deepEqual(stan.map((s) => [s.retry, s.przebiegi]), [[true, 0], [false, 10]])
  const puste = await testerPorcjami(porcje, async () => null)
  assert.equal(puste.wynik, null)
})

test('tester porcjami: SKIP z przyczyna srodowisko konczy porcje — kolejne nie startuja (scenariusze bez wpisu ida na [Manual])', async () => {
  const porcje = porcjeScenariuszy(30, 10)
  /** @type {number[]} */
  const wywolania = []
  const { wynik, porcje: stan } = await testerPorcjami(porcje, async (p) => {
    wywolania.push(p.nr)
    return { findings: [], przebiegi: p.nr === 2 ? przebiegi(p.od, p.do, 'SKIP', 'srodowisko') : przebiegi(p.od, p.do) }
  })
  assert.deepEqual(wywolania, [1, 2])
  assert.equal(wynik?.przebiegi.length, 20)
  assert.deepEqual(stan.map((s) => s.przerwana), [false, true, false])
})

test('workflow: porcje tylko przy znanej liczbie powyzej progu, bez globalnego retry; etykieta porcji i polecenie z zakresem', () => {
  assert.match(zrodlo, /e2eLiczbaZnana && e2eCheckboxy > MAKS_SCENARIUSZY_TESTERA \? porcjeScenariuszy\(e2eCheckboxy, MAKS_SCENARIUSZY_TESTERA\) : null/)
  assert.match(zrodlo, /label: `review:e2e:\$\{p\.nr\}\$\{retry \? ':retry' : ''\}`/)
  assert.match(zrodlo, /if \(e2eAktywny && !porcjeE2e && brakPrzebiegow\(wyniki\[indeksE2e\]\)\)/)
  assert.match(wytnij('function e2ePrompt(', '\n}'), /Porcja \$\{porcja\.nr\} z \$\{porcja\.z\}: scenariusze \$\{porcja\.od\}–\$\{porcja\.do\}/)
})

test('plik roli: porcja odgrywa tylko swoj zakres listy skryptu; makiety i runner tylko w porcji 1', () => {
  const linia = tester.split('\n').find((l) => l.startsWith('- (porcja w poleceniu')) ?? ''
  assert.match(linia, /`Porcja <nr> z <z>: scenariusze <od>–<do>`/)
  assert.match(linia, /tylko scenariusze o numerach od `<od>` do `<do>` w kolejności listy skryptu \(numeracja od 1\)/)
  assert.match(linia, /makiety `figma_screens` i linię runnera `e2e\/<etap>-run-all\.sh` obsługuje tylko porcja 1/)
})

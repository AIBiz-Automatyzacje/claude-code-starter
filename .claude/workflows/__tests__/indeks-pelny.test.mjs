// Pelny indeks wiedzy = widoczny sygnal dla operatora (PLAN-POPRAWY P10, 6a pkt 60 g3a).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/indeks-pelny.test.mjs
//
// DLACZEGO: w smoke'u P10 compound trafil na bramke indeksu, a waski refresh autopilota skrocil regule, zeby zmiescic
// indeks w limicie (utrata tresci), i run skonczyl sie bez slowa dla operatora. Teraz waski refresh nie porzadkuje
// indeksu pod limit, a bramka konczy sie zdaniem w wyniku autopilota i raporcie /dev-pr.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodloAutopilot = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')

/** @param {string} zrodlo @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca po "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

/** @typedef {{ indeks: string } | null} WynikZIndeksem */
/** @type {{ INDEKS_PELNY: string, uwagaIndeksu: (compound: WynikZIndeksem, refresh: WynikZIndeksem) => string }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const A = new Function(`${wytnij(zrodloAutopilot, 'const INDEKS_PELNY =', '\n')}
  ${wytnij(zrodloAutopilot, 'function uwagaIndeksu(', '\n}')}
  return { INDEKS_PELNY, uwagaIndeksu }`)()

test('autopilot: bramka indeksu w compoundzie bez zapisu w refreshu = zdanie dla operatora', () => {
  assert.equal(A.INDEKS_PELNY, 'Indeks wiedzy pelny — uruchom /dev-compound-refresh (pelny przeglad)')
  assert.equal(A.uwagaIndeksu({ indeks: 'bramka' }, null), A.INDEKS_PELNY)
  assert.equal(A.uwagaIndeksu({ indeks: 'bramka' }, { indeks: 'bramka' }), A.INDEKS_PELNY)
  assert.equal(A.uwagaIndeksu({ indeks: 'bramka' }, { indeks: 'zapisany' }), '')
  assert.equal(A.uwagaIndeksu({ indeks: 'zapisany' }, null), '')
  assert.equal(A.uwagaIndeksu(null, null), '')
})

test('autopilot: zdanie o pelnym indeksie w wyniku runu i w logu konca, liczone z compoundu i refreshu', () => {
  const wynikRunu = zrodloAutopilot.slice(zrodloAutopilot.lastIndexOf("return {\n  status: 'OK',"))
  assert.match(wynikRunu, /uwagaIndeksu: uwagaIndeksu\(compound, refresh\),/)
  assert.match(zrodloAutopilot, /if \(uwagaIndeksu\(compound, refresh\)\) log\(uwagaIndeksu\(compound, refresh\)\)/)
})

test('waski refresh: przy bramce rozmiaru nie skraca, nie scala i nie archiwizuje pod limit; zwraca stan indeksu', () => {
  const prompt = wytnij(zrodloAutopilot, 'const refreshPrompt = (plik, kategoria) =>', 'RefreshResult')
  assert.match(prompt, /Bramka rozmiaru indeksu \(\\`indeks: \.\.\. zn, limit\\`\): tresci regul nie skracasz, nie scalasz i nie archiwizujesz solutions pod limit/)
  assert.match(prompt, /zwroc indeks="bramka"/)
  const schemat = wytnij(zrodloAutopilot, 'const REFRESH_RESULT = {', '\n}')
  assert.match(schemat, /indeks: \{ type: 'string', enum: \['zapisany', 'bramka', 'bez zmian'\]/)
  assert.match(schemat, /required: \['przejrzano', 'slownik', 'commit', 'indeks', 'stanZapisany'\]/)
})

test('/dev-pr compound: bramka indeksu = to samo zdanie w wyniku etapu i w raporcie skilla', () => {
  const zrodloPr = readFileSync(resolve(KATALOG, '../dev-pr-wf.js'), 'utf8')
  assert.equal(wytnij(zrodloPr, 'const INDEKS_PELNY =', '\n'), wytnij(zrodloAutopilot, 'const INDEKS_PELNY =', '\n'))
  const etap = wytnij(zrodloPr, "if (etap === 'compound') {", '\n}')
  assert.match(etap, /uwagaIndeksu: wynik\.indeks === 'bramka' \? INDEKS_PELNY : ''/)
  const skillPr = readFileSync(resolve(KATALOG, '../../skills/dev-pr/SKILL.md'), 'utf8')
  assert.match(skillPr, /<uwagaIndeksu z etapu compound, gdy niepusta: „Indeks wiedzy pełny — uruchom `\/dev-compound-refresh` \(pełny przegląd\)”>/)
})

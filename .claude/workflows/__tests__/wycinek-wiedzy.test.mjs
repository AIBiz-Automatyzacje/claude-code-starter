// Wycinek wiedzy zamiast calego learned-patterns (PLAN-POPRAWY P10; H50 jako tresc, PA-13): planner wkleja do promptu
// kazdej jednostki reguly dla jej plikow, reviewerzy dostaja wycinek w dossier albo licza go tym samym skryptem.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/wycinek-wiedzy.test.mjs
//
// DLACZEGO: regula wklejona do promptu delegacji jest stosowana (mini-run a: 40/40), a regula czekajaca w pliku bywa
// pomijana (ETAP1: 45/68 ucieczek mialo regule); caly plik regul to ~47k zn w kazdym builderze i reviewerze.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodloExecute = readFileSync(resolve(KATALOG, '../dev-docs-execute-wf.js'), 'utf8')
const zrodloReview = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')

/** @param {string} zrodlo @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(zrodlo, kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca po "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

/** @type {(sciezka: string, faza: number) => string} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const plannerPrompt = new Function(`${wytnij(zrodloExecute, 'function plannerPrompt(', '\n}')}\nreturn plannerPrompt`)()
/** @type {(faza: number, kontekst: unknown) => string} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const zrodlaBlok = new Function(`${wytnij(zrodloReview, 'function zrodlaBlok(', '\n}')}\nreturn zrodlaBlok`)()

const planner = plannerPrompt('docs/active/x', 2)

test('planner: wycinek wiedzy po plikach jednostki w prompcie IU, nie caly plik regul (H50, PA-13)', () => {
  assert.match(planner, /`node \.claude\/scripts\/wiedza\/wiedza\.mjs wycinek --pliki <pliki jednostki po przecinku>`/)
  assert.match(planner, /"Wyuczone reguly projektu:"/)
  assert.match(planner, /regula wklejona do promptu delegacji jest przez buildera stosowana, a regula czekajaca w pliku bywa pomijana/)
  assert.doesNotMatch(planner, /learned-patterns|ok\. 11 KB|gwarancji dostepu|w CALOSCI/)
})

test('reviewer bez dossier: wycinek tym samym skryptem po plikach fazy, bez starej sciezki regul', () => {
  const bez = zrodlaBlok(3, null)
  assert.match(bez, /`node \.claude\/scripts\/wiedza\/wiedza\.mjs wycinek --pliki <pliki zmienione w fazie po przecinku>`/)
  assert.match(bez, /naruszenie ktorejkolwiek z nich zglos jako finding/)
  assert.match(zrodlaBlok(3, { ctxZapisany: true, ctxPlik: '/tmp/c.md' }), /sekcji "Reguly projektu" dossier/)
  assert.doesNotMatch(zrodloReview, /\.claude\/rules\/learned-patterns/)
})

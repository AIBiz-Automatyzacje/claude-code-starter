// Polecenie reviewera osi w dev-docs-review-wf.js (PLAN-POPRAWY P11): jedno `reviewerPrompt` dla wszystkich osi, procedura
// w pliku roli. Test-coverage nie ma osobnego polecenia — dostaje blok dlugich komend jako dodatek (uruchamia testy),
// a procedura semantyki pol siedzi w plikach rol spec i test-coverage. Funkcje wyciete ze zrodla workflowu.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/reviewer-prompt.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const zrodlo = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../dev-docs-review-wf.js'), 'utf8')

/** @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

// Bloki wspolne podstawione znacznikami: test sprawdza sklad polecenia, tresc blokow maja ich wlasni odbiorcy.
// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const reviewerPrompt = new Function(
  `const BLOK_ZAUFANIE = '[ZAUFANIE]'
   const BLOK_LIMIT_P3 = '[LIMIT-P3]'
   const mapaBlok = () => '[MAPA]'
   const rereviewBlok = (p) => (p.length ? '[REREVIEW]' : '')
   ${wytnij('function zrodlaBlok(', '\n}')}
   ${wytnij('function reviewerPrompt(', '\n}')}
   return reviewerPrompt`,
)()

test('reviewerPrompt: os, faza i folder w poleceniu; bloki wspolne; dodatek osi przed blokami', () => {
  const p = reviewerPrompt('docs/active/z', 2, 'testy fazy wg list z pliku Twojej roli', [], null, '[KOMENDY]')
  assert.match(p, /fazy 2/)
  assert.match(p, /docs\/active\/z/)
  assert.match(p, /testy fazy wg list z pliku Twojej roli/)
  assert.match(p, /\[KOMENDY\]\[ZAUFANIE\]\[LIMIT-P3\]\[MAPA\]$/)
})

test('reviewerPrompt: bez dodatku i z poprzednimi findingami = tryb re-review na koncu', () => {
  const p = reviewerPrompt('docs/active/z', 1, 'os', [{ severity: 'P2' }], null)
  assert.match(p, /\[ZAUFANIE\]\[LIMIT-P3\]\[MAPA\]\[REREVIEW\]$/)
  assert.doesNotMatch(p, /undefined/)
})

test('reviewerPrompt: bez tozsamosci "Jestes" (mandat jest w pliku roli)', () => {
  assert.doesNotMatch(reviewerPrompt('x', 1, 'os', [], null), /^Jeste[sś]/m)
})

test('wiring: test-coverage przez reviewerPrompt z blokiem dlugich komend; osobnego polecenia i bloku semantyki brak', () => {
  assert.match(zrodlo, /r\.key === 'test-coverage'\) return agent\(reviewerPrompt\(sciezka, faza, r\.fokus, poprzTest, kontekst, BLOK_DLUGIE_KOMENDY\)/)
  assert.doesNotMatch(zrodlo, /function testCoveragePrompt|BLOK_SEMANTYKA/)
})

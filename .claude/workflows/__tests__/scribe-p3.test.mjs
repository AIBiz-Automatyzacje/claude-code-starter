// Testy dev-docs-review-wf.js: P3 trwale w known-issues (pisze scribe), blok limitu P3 pod semantyke „P3 poza fixem”
// (PLAN-POPRAWY P8; hunki H52, H53, H62 jako tresc).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/scribe-p3.test.mjs
//
// Fix naprawia od P8 tylko P1/P2. Faza z samymi P3 nie ma agenta fixa, wiec P3 zapisuje scribe — do known-issues, nie tylko
// do stanu, zeby wznowienie ich nie zgubilo (oferty-online, faza 6: 13 utraconych P3).

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')

/**
 * @param {string} kotwica
 * @param {string} koniec
 * @returns {string}
 */
function wytnij(kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca po "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

/** @typedef {{ e2eStatus: string, e2ePrzebiegi: unknown[], e2eTesterFail: boolean, e2eWykonany: boolean }} PrzebiegScribe */
/** @type {{ scribePrompt: (sciezka: string, faza: number, potwierdzone: unknown[], przebieg: PrzebiegScribe, obalone: unknown[]) => string, BLOK_LIMIT_P3: string }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { scribePrompt, BLOK_LIMIT_P3 } = new Function('przebiegBlok',
  `${wytnij('function scribePrompt(', '\n}')}
   ${wytnij('const BLOK_LIMIT_P3 = `', '=== KONIEC BLOKU LIMITU P3 ===`')}
   return { scribePrompt, BLOK_LIMIT_P3 }`,
)(() => '## Przebieg review')

/** @type {PrzebiegScribe} */
const PRZEBIEG = { e2eStatus: 'pominiety', e2ePrzebiegi: [], e2eTesterFail: false, e2eWykonany: true }
const prompt = scribePrompt('docs/active/x', 4, [], PRZEBIEG, [])

test('scribe: P3 typu KOD/TEST ida do known-issues, sekcja "## P3 faza N", dopisanie bez duplikatow', () => {
  assert.match(prompt, /docs\/active\/x\/known-issues\.md/)
  assert.match(prompt, /## P3 faza 4/)
  assert.match(prompt, /- 🟡 \[P3\] <plik:linia> — <opis>/)
  assert.match(prompt, /bez duplikatow/i)
  assert.match(prompt, /nie usuwaj/i, 'powtorka review po STOP-ie nie moze skasowac P3 z przerwanego podejscia')
})

test('scribe: "Do poprawy" to P1 i P2 — P3 nie ida do fixa', () => {
  assert.match(prompt, /"## Do poprawy po review fazy 4"\n\s+— wylistuj findingi typu KOD\/TEST\/E2E o severity P1 i P2 jako checkbox/)
  assert.doesNotMatch(prompt, /ORAZ findingi P3|agentowi fixa razem z P1\/P2/)
})

test('scribe: prompt krotszy niz przed P8 (8297 znakow stalej czesci)', () => {
  assert.ok(prompt.length <= 7000, `stala czesc promptu scribe: ${prompt.length} znakow`)
})

test('blok limitu P3: P3 laduja w known-issues i opisie PR, nie w fixie', () => {
  assert.doesNotMatch(BLOK_LIMIT_P3, /DO NAPRAWY|agenta fixa|ture/)
  assert.match(BLOK_LIMIT_P3, /known-issues/)
  // Zmiana kontraktu (P11): blok wg zasad pisania bez wersalikow nacisku — warunek akcyjnosci ten sam, brzmienie malymi literami.
  assert.match(BLOK_LIMIT_P3, /dokladnie jeden plik z numerem linii/, 'akcyjnosc zostaje: wpis known-issues czyta ktos bez kontekstu review')
})

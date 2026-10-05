// Wycinek wiedzy dla buildera i reviewera (PLAN-POPRAWY P10): reguly, ktorych globy pasuja do plikow IU / fazy,
// plus koszyk „zawsze”, w limicie znakow — zamiast calego pliku learned-patterns w kazdym agencie.

import test from 'node:test'
import assert from 'node:assert/strict'

import { MAKS_WYCINEK_ZN, wycinek } from '../wycinek.mjs'

/** @param {string} plik @param {Record<string, string | string[]>} zmiany */
function wpis(plik, zmiany) {
  return {
    plik,
    pola: {
      klasa: 'sciezka-bledu', regula: `Regula ${plik}.`, paths: ['src/lib/**'], waga: 'srednia', szczebel: 'regula',
      szczebel_powod: 'x', date: '2026-09-01', zrodlo: 'PR 1', ucieczki: '0', ...zmiany,
    },
  }
}

const WPISY = [
  wpis('docs/solutions/a/lib.md', { paths: ['src/lib/**'] }),
  wpis('docs/solutions/a/ui.md', { paths: ['src/components/**/*.tsx'], waga: 'wysoka' }),
  wpis('docs/solutions/a/sql.md', { paths: ['supabase/migrations/**'] }),
  wpis('docs/solutions/a/zawsze.md', { paths: ['**'], waga: 'niska' }),
  wpis('docs/solutions/a/lint.md', { paths: ['src/lib/**'], szczebel: 'lint', bramka: 'eslint.config.js no-restricted-syntax' }),
  wpis('docs/solutions/a/kod.md', { paths: ['src/lib/**'], szczebel: 'kod' }),
]

test('wycinek: reguly z globami pasujacymi do plikow (takze nowych, jeszcze nieistniejacych) + koszyk „zawsze”; kod/lint z wdrozona bramka poza wycinkiem', () => {
  const w = wycinek(WPISY, ['src/lib/nowy-modul.ts', 'src/components/oferta/Karta.tsx'])
  assert.deepEqual(w.pliki, ['docs/solutions/a/zawsze.md', 'docs/solutions/a/ui.md', 'docs/solutions/a/lib.md', 'docs/solutions/a/kod.md'])
  assert.match(w.tresc, /^- \[niska\] sciezka-bledu: Regula docs\/solutions\/a\/zawsze\.md\. \(docs\/solutions\/a\/zawsze\.md\)$/m)
  assert.doesNotMatch(w.tresc, /sql\.md|lint\.md/)
  assert.equal(w.zn, w.tresc.length)
})

test('wycinek: brak pasujacych regul i brak koszyka = pusty wycinek', () => {
  const w = wycinek(WPISY.filter((x) => x.plik !== 'docs/solutions/a/zawsze.md'), ['README.md'])
  assert.deepEqual({ tresc: w.tresc, wpisy: w.wpisy, pominiete: w.pominiete }, { tresc: '', wpisy: 0, pominiete: 0 })
})

test('wycinek: limit znakow — reguly ponad limit pominiete z odeslaniem do indeksu, tresc w limicie', () => {
  const duzo = Array.from({ length: 40 }, (_, i) => wpis(`docs/solutions/b/${i}.md`, { regula: `${'Regula dluga. '.repeat(1)}${'x'.repeat(150)} ${i}.` }))
  const w = wycinek(duzo, ['src/lib/a.ts'])
  assert.ok(w.zn <= MAKS_WYCINEK_ZN, `${w.zn}`)
  assert.ok(w.pominiete > 0)
  assert.equal(w.wpisy + w.pominiete, 40)
  assert.match(w.tresc, new RegExp(`\\+${w.pominiete} regul poza limitem wycinka — pelna lista: docs/learned-patterns\\.md$`))
})

test('wycinek: duplikat reguly (ta sama klasa i tresc) nie zajmuje limitu — zostaje nowszy', () => {
  const w = wycinek([
    wpis('docs/solutions/a/stary.md', { regula: 'Waliduj wejscie.', date: '2026-08-01' }),
    wpis('docs/solutions/a/nowy.md', { regula: 'Waliduj wejscie.', date: '2026-09-01' }),
  ], ['src/lib/a.ts'])
  assert.deepEqual(w.pliki, ['docs/solutions/a/nowy.md'])
})

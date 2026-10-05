// Polecenie reviewera osi w dev-docs-review-wf.js (PLAN-POPRAWY P11): jedno `reviewerPrompt` dla wszystkich osi, procedura
// w pliku roli. Test-coverage nie ma osobnego polecenia — dostaje blok dlugich komend jako dodatek (uruchamia testy),
// a procedura semantyki pol siedzi w plikach rol spec i test-coverage. Funkcje wyciete ze zrodla workflowu.
//
// Uruchomienie:  node --test .claude/workflows/__tests__/reviewer-prompt.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { liczbaPolecen } from '../../scripts/doctor/warstwa-stala.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const AGENCI = resolve(KATALOG, '../../agents')
const zrodlo = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')

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

// Prompt osi w jednym miejscu: os, ktorej plik roli ma blok polecen, dostaje w fokusie sama nazwe osi — procedura
// w fokusie i w pliku rozjezdza sie przy pierwszej zmianie jednego z nich.
// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const REVIEWERZY = /** @type {{ key: string, agentType: string, fokus: string }[]} */ (new Function(`${wytnij('const REVIEWERZY = [', '\n]')}\nreturn REVIEWERZY`)())
const MAKS_FOKUSU_OSI_Z_PLIKIEM = 80

test('fokus: os z blokiem polecen w pliku roli niesie w fokusie sama nazwe osi', () => {
  const zPlikiem = REVIEWERZY.filter((r) => liczbaPolecen(readFileSync(join(AGENCI, `${r.agentType}.md`), 'utf8')) > 0)
  assert.ok(zPlikiem.some((r) => r.key === 'code-quality'))
  for (const r of zPlikiem) {
    assert.match(r.fokus, /wg list z pliku Twojej roli$/, r.key)
    assert.ok(r.fokus.length <= MAKS_FOKUSU_OSI_Z_PLIKIEM, `${r.key}: fokus ${r.fokus.length} zn.`)
  }
})

// Bloki doklejane do polecen reviewerow (granice zaufania dla osi i sceptykow, limit P3, mapa zmian, tryb re-review)
// wg zasad pisania: powod zamiast nacisku. Wersaliki zostaja w liniach-znacznikach `===` i w skrotach oraz nazwach typow.
const WERSALIKI = /\b[A-Z]{3,}\b/g
const SKROTY = new Set(['API', 'ETL', 'OPERATOR', 'JSON'])
const BLOKI = [
  ['BLOK_ZAUFANIE', 'const BLOK_ZAUFANIE = `', '=== KONIEC BLOKU'],
  ['BLOK_LIMIT_P3', 'const BLOK_LIMIT_P3 = `', '=== KONIEC BLOKU'],
  ['rereviewBlok', 'function rereviewBlok(', '\n}'],
  ['mapaBlok', 'function mapaBlok(', '\n}'],
]

for (const [nazwa, kotwica, koniec] of BLOKI) {
  test(`${nazwa}: bez wersalikow nacisku poza liniami-znacznikami`, () => {
    const tresc = wytnij(kotwica, koniec).split('\n').filter((l) => !/^\s*(?:===|\/\/|const |function )/.test(l)).join('\n')
    assert.deepEqual([...tresc.matchAll(WERSALIKI)].map((m) => m[0]).filter((w) => !SKROTY.has(w)), [])
  })
}

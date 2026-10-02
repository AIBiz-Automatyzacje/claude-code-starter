// Test dlugosci opisow workflowow-dzieci w liscie skilli sesji glownej (PANEL-WYNIK D9, PLAN-POPRAWY P3).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/lista-skilli.test.mjs
//
// DLACZEGO: `description` i `whenToUse` z `meta` kazdego workflowu trafiaja do listy skilli doklejanej do kazdej tury
// sesji glownej. Dzieci (execute, review, compound, complete) wola autopilot, nie model sesji, wiec ich opis nie pomaga
// w wyborze. D9 zakladalo flage `disable-model-invocation`, ale loader workflowow projektu (Claude Code 2.1.287) bierze
// z `meta` tylko name, description, title, whenToUse i phases — flaga bylaby cicho pominieta. Sciezka odwrotu D9:
// krotkie opisy dzieci, a ten test pilnuje, zeby nie urosly z powrotem.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG_WORKFLOWOW = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DZIECI = ['dev-docs-execute-wf', 'dev-docs-review-wf', 'dev-compound-wf', 'dev-docs-complete-wf']
// Jedno zdanie opisu + jedno zdanie wywolania (w 2026-10 przed skroceniem: 230–1001 znakow na dziecko).
const LIMIT_ZNAKOW = 160

/**
 * @param {string} zrodlo
 * @param {string} pole
 * @returns {string}  wartosc pola `meta` zapisanego w jednej linii ('…' albo "…")
 */
function poleMeta(zrodlo, pole) {
  const m = zrodlo.match(new RegExp(`^  ${pole}: (["'])((?:\\\\.|(?!\\1).)*)\\1,$`, 'm'))
  return m?.[2] ?? ''
}

/**
 * @param {Record<string, string>} zrodla  nazwa workflowu → zrodlo
 * @returns {string[]}
 */
function naruszeniaOpisow(zrodla) {
  return Object.entries(zrodla).flatMap(([nazwa, zrodlo]) => {
    const opis = poleMeta(zrodlo, 'description')
    const dlugosc = opis.length + poleMeta(zrodlo, 'whenToUse').length
    if (!opis) return [`${nazwa}: brak description`]
    return dlugosc > LIMIT_ZNAKOW ? [`${nazwa}: description + whenToUse ${dlugosc} zn > ${LIMIT_ZNAKOW}`] : []
  })
}

test('opisy dzieci: podlozony za dlugi opis i brak description sa zglaszane', () => {
  const meta = (/** @type {string} */ d, /** @type {string} */ w) => `export const meta = {\n  name: 'x',\n${d}\n  whenToUse: '${w}',\n}`
  assert.deepEqual(naruszeniaOpisow({
    krotki: meta("  description: 'Jedno zdanie.',", 'Wolany przez autopilota.'),
    dlugi: meta(`  description: "${'a'.repeat(150)}",`, 'b'.repeat(20)),
    bezOpisu: meta('', 'w'),
  }), ['dlugi: description + whenToUse 170 zn > 160', 'bezOpisu: brak description'])
})

test('opisy dzieci: cztery workflowy wolane przez autopilota maja krotkie description + whenToUse', () => {
  const zrodla = Object.fromEntries(DZIECI.map((n) => [n, readFileSync(join(KATALOG_WORKFLOWOW, `${n}.js`), 'utf8')]))
  assert.deepEqual(naruszeniaOpisow(zrodla), [])
})

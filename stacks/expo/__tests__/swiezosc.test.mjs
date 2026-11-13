// Świeżość źródeł wariantu Expo (Etap 5): przypięcia z plików szablonu, upstream z atrapy sieci (gh i npm to usługi zewnętrzne).
//
// Uruchomienie: node --test stacks/expo/__tests__/swiezosc.test.mjs

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { przypiecia, sprawdzSwiezosc } from '../swiezosc.mjs'

const KORZEN = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const P = przypiecia(KORZEN)

/** @param {{ expo?: string, plikiExpo?: string[], uniwind?: string, latest?: string }} upstream */
function siec({ expo = P.expo.sha, plikiExpo = [], uniwind = P.uniwind, latest = `${P.sdk}.0.25` } = {}) {
  /** @type {string[]} */
  const wolane = []
  return {
    wolane,
    gh: (/** @type {string} */ s) => {
      wolane.push(s)
      if (s.startsWith(`repos/expo/skills/commits?path=${P.expo.sciezka}`)) return JSON.stringify([{ sha: expo }])
      if (s.startsWith('repos/expo/skills/compare/')) return JSON.stringify({ total_commits: plikiExpo.length ? 4 : 0, files: plikiExpo.map((f) => ({ filename: f })) })
      if (s.startsWith('repos/uni-stack/uniwind/commits')) return JSON.stringify([{ sha: uniwind }])
      if (s === 'repos/mobile-dev-inc/maestro/releases/latest') return JSON.stringify({ tag_name: 'cli-2.12.1' })
      throw new Error(`nieoczekiwane zapytanie: ${s}`)
    },
    npm: () => JSON.stringify({ latest }),
  }
}

test('przypięcia z plików szablonu: sha pluginu expo, commit Uniwind, SDK z tabeli wersji', () => {
  assert.match(P.expo.sha, /^[0-9a-f]{40}$/)
  assert.equal(P.expo.sciezka, 'plugins/expo')
  assert.match(P.uniwind, /^[0-9a-f]{40}$/)
  assert.ok(P.sdk >= 58)
})

test('wszystko aktualne: każda pozycja aktualne, bez uwag poza Maestro (nieprzypięte)', () => {
  const s = siec()
  const w = sprawdzSwiezosc(s, KORZEN)
  assert.deepEqual(w.map((p) => p.aktualne), [true, true, true, true])
  assert.deepEqual(w.slice(0, 3).map((p) => p.uwaga), ['', '', ''])
  assert.equal(w[3].upstream, '2.12.1')
  assert.match(w[3].uwaga, /maestro --version/)
})

test('nowszy upstream: plugin z plikami pluginu, nowszy skill Uniwind i nowy SDK = nieaktualne z drogą przeglądu', () => {
  const nowy = 'f'.repeat(40)
  const w = sprawdzSwiezosc(siec({ expo: nowy, plikiExpo: ['plugins/expo/skills/expo-overview/SKILL.md', 'plugins/expo-experiments/plugin.json'], uniwind: nowy, latest: `${P.sdk + 1}.0.1` }), KORZEN)
  assert.equal(w[0].aktualne, false)
  assert.equal(w[0].uwaga, '4 commitów, 1 plików pluginu do przeglądu (SWIEZOSC.md, „Plugin expo”)', 'liczy tylko pliki pluginu expo, nie sąsiednich pluginów')
  assert.deepEqual([w[1].aktualne, w[1].upstream], [false, 'fffffff'])
  assert.deepEqual([w[2].aktualne, w[2].upstream], [false, `SDK ${P.sdk + 1} (${P.sdk + 1}.0.1)`])
})

test('nowy commit repo bez zmian w plikach pluginu expo = aktualne', () => {
  const w = sprawdzSwiezosc(siec({ expo: 'e'.repeat(40), plikiExpo: ['plugins/expo-experiments/plugin.json'] }), KORZEN)
  assert.deepEqual([w[0].aktualne, w[0].uwaga], [true, ''])
})

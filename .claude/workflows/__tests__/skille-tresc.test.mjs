// Tresc zasobow skilli, ktora przenosi wzorzec poprawki z projektu do szablonu (plan paczki P27-P29-E5, S2).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/skille-tresc.test.mjs

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const PERFORMANCE = readFileSync(resolve(KATALOG, '../../skills/tailwind-react-guidelines/resources/performance.md'), 'utf8')

/** @param {string} tekst @param {string} naglowek @returns {string} */
function sekcja(tekst, naglowek) {
  const start = tekst.indexOf(`\n${naglowek}\n`)
  assert.notEqual(start, -1, `brak sekcji ${naglowek}`)
  const poziom = naglowek.split(' ')[0]
  const reszta = tekst.slice(start + naglowek.length + 2)
  const koniec = reszta.search(new RegExp(`\\n#{1,${poziom.length}} `))
  return koniec === -1 ? reszta : reszta.slice(0, koniec)
}

// P27(4a) vibersi `glos-przeniesienie`: invalidateQueries przy pierwszym pobraniu w toku (data undefined) nie anuluje go,
// tylko zwraca jego obietnice (query-core `cancelRefetch` dziala przy data !== undefined) — w pamieci zostaje wynik sprzed zapisu.
test('performance.md React Query: cancelQueries przed invalidateQueries przy kluczu w pierwszym pobraniu; test z odroczonym queryFn', () => {
  const rq = sekcja(PERFORMANCE, '### React Query (Rekomendowane dla SPA)')
  assert.match(rq, /`cancelQueries`[^.]*przed[^.]*`invalidateQueries`/)
  assert.match(rq, /pierwsze(go)? pobrani/)
  assert.match(rq, /data === undefined|bez danych/)
  assert.match(rq, /odroczon[^.]*`queryFn`/)
  assert.match(rq, /nie `fetch`|zamiast `fetch`/)
})

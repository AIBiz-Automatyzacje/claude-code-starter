// Testy dwoch helperow dev-autopilot-wf.js z audytu 2026-09-06: skrot `e2eSync` do telemetrii (N6)
// i bilans tury poprawkowej po kontroli diffu naprawczego (N9).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/telemetria-i-kontrola-fixa.test.mjs
//   albo caly katalog:  node --test '.claude/workflows/__tests__/*.test.mjs'   (glob w apostrofach)
//
// N6: `e2eSync` to swobodny raport agenta db-sync; w JSONL zajmowal 35-45% wpisu (3 335 z 7 450 B),
//     a analiza telemetrii potrzebuje statusu, nie instrukcji dla czlowieka. Pelny tekst zostaje
//     w `raporty[]` (wynik runu / STOP) i w logu — skracamy WYLACZNIE to, co idzie do pliku telemetrii.
// N9: `kontrolaFixa` szla do stanu jako {pozycje, naprawione, walidacja} i gubila `nienaprawione[]`
//     z odpowiedzi agenta. Przy 61 pozycjach / 55 naprawionych / PASS dwie pozycje nie mialy sladu.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-autopilot-wf.js'), 'utf8')

// Ekstrakcja ze zrodla — workflowy sa skryptami runtime'u Workflow, `import()` ich nie zaladuje.
// `new Function` z interpolacja jest tu bezpieczny: wklejamy fragment z pliku w tym repo, nie z inputu.
/**
 * @param {string} kotwica
 * @param {string} koniec
 * @param {string} opis
 * @returns {string}
 */
function wytnij(kotwica, koniec, opis) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu (${opis}) wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca ${opis}`)
  return zrodlo.slice(start, stop + koniec.length)
}

// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { skrotE2eSync, podsumujKontroleFixa, E2E_SYNC_LIMIT_TELEMETRII } = new Function(
  `${wytnij('const E2E_SYNC_LIMIT_TELEMETRII =', '\n', 'E2E_SYNC_LIMIT_TELEMETRII')}
   ${wytnij('function skrotE2eSync(', '\n}', 'skrotE2eSync')}
   ${wytnij('function podsumujKontroleFixa(', '\n}', 'podsumujKontroleFixa')}
   return { skrotE2eSync, podsumujKontroleFixa, E2E_SYNC_LIMIT_TELEMETRII }`,
)()

// ── N6 ────────────────────────────────────────────────────────────────────

test('krotki e2eSync i "n/a" przechodza bez zmian', () => {
  assert.equal(skrotE2eSync('n/a'), 'n/a')
  assert.equal(skrotE2eSync('aktualna: Remote database is up to date'), 'aktualna: Remote database is up to date')
})

test('dlugi e2eSync jest ucinany do limitu z jawnym znacznikiem i dlugoscia oryginalu', () => {
  const dlugi = 'zsynchronizowano: ' + 'x'.repeat(3300)
  const s = skrotE2eSync(dlugi)
  assert.ok(s.length < 300, `skrot ma ${s.length} znakow — telemetria nie moze dalej niesc calego raportu agenta`)
  assert.ok(s.startsWith('zsynchronizowano: '), 'status na poczatku musi przetrwac — to jedyna czesc, ktorej analiza uzywa')
  assert.match(s, /uciete: 3318 znakow/, 'odbiorca ma wiedziec, ze to skrot i ile przepadlo')
  assert.match(s, /pelna tresc w logu runu/, 'skrot ma wskazywac, gdzie jest reszta')
})

test('e2eSync inny niz string (null z padnietego agenta) nie wywala telemetrii', () => {
  assert.equal(skrotE2eSync(null), null)
  assert.equal(skrotE2eSync(undefined), undefined)
})

test('limit jest sensowny: miesci status i zdanie, nie miesci raportu', () => {
  assert.ok(E2E_SYNC_LIMIT_TELEMETRII >= 120 && E2E_SYNC_LIMIT_TELEMETRII <= 400, `limit ${E2E_SYNC_LIMIT_TELEMETRII} — poza rozsadnym zakresem`)
})

// ── N9 ────────────────────────────────────────────────────────────────────

test('komplet napraw: zero pominietych, zero bez sladu', () => {
  const k = podsumujKontroleFixa(5, { naprawione: 5, walidacja: 'PASS', nienaprawione: [] })
  assert.deepEqual(k, { pozycje: 5, naprawione: 5, walidacja: 'PASS', pominiete: [], bezSladu: 0 })
})

test('pominiete Z uzasadnieniem wchodza do stanu, bilans sie zgadza', () => {
  const k = podsumujKontroleFixa(61, {
    naprawione: 55, walidacja: 'PASS',
    nienaprawione: [
      'decision-service.test.ts:12 — rzutowanie na granicy zewnetrznego SDK (dubler Supabase)',
      'queue-store.test.ts:40 — jw.',
      'a.test.ts:1 — dubler ClientRequest Node',
      'b.test.ts:2 — dubler ClientRequest Node',
      'c.ts:9 — poza zakresem fazy',
      'd.ts:3 — poza zakresem fazy',
    ],
  })
  assert.equal(k.pominiete.length, 6, 'uzasadnienia agenta NIE moga byc wyrzucane — to byl caly problem N9')
  assert.equal(k.bezSladu, 0)
})

test('luka bez uzasadnienia jest POLICZONA — PASS przy 55/61 nie udaje 61/61', () => {
  // Dokladnie przypadek z produkcji: 61 pozycji, 55 naprawionych, 4 opisane, 2 znikaja.
  const k = podsumujKontroleFixa(61, { naprawione: 55, walidacja: 'PASS', nienaprawione: ['a', 'b', 'c', 'd'] })
  assert.equal(k.bezSladu, 2, 'dwie pozycje ani nie naprawione, ani nie uzasadnione — musza byc widoczne jako liczba')
  assert.equal(k.walidacja, 'PASS', 'walidacja zostaje taka, jaka zglosil agent — bezSladu jest OBOK niej, nie zamiast')
})

test('brak pola nienaprawione (agent pominal) = wszystko nienaprawione jest bez sladu', () => {
  const k = podsumujKontroleFixa(10, { naprawione: 7, walidacja: 'PASS' })
  assert.deepEqual(k.pominiete, [])
  assert.equal(k.bezSladu, 3)
})

test('puste i nie-stringowe wpisy w nienaprawione nie licza sie jako uzasadnienie', () => {
  const k = podsumujKontroleFixa(4, { naprawione: 2, walidacja: 'PASS', nienaprawione: ['', '   ', null, 'x.ts:1 — realny powod'] })
  assert.deepEqual(k.pominiete, ['x.ts:1 — realny powod'])
  assert.equal(k.bezSladu, 1)
})

test('agent zglaszajacy wiecej niz bylo pozycji nie daje ujemnego bezSladu', () => {
  const k = podsumujKontroleFixa(3, { naprawione: 5, walidacja: 'PASS', nienaprawione: [] })
  assert.equal(k.bezSladu, 0)
})

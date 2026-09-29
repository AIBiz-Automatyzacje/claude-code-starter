// Testy dev-autopilot-wf.js: bilans tury poprawkowej po kontroli diffu naprawczego (audyt 2026-09-06, N9) oraz strażnik
// It. 1 — orkiestrator nie powołuje agenta telemetrii i nie liczy tokenów z budget.spent().
//
// Uruchomienie:  node --test .claude/workflows/__tests__/kontrola-fixa.test.mjs
//   albo caly katalog:  node --test '.claude/workflows/__tests__/*.test.mjs'   (glob w apostrofach)
//
// N9: `kontrolaFixa` szla do stanu jako {pozycje, naprawione, walidacja} i gubila `nienaprawione[]`
//     z odpowiedzi agenta. Przy 61 pozycjach / 55 naprawionych / PASS dwie pozycje nie mialy sladu.
// Skrot `e2eSync` (N6) przeniesiony razem z testami do telemetrii (.claude/scripts/telemetria/faza.mjs) — It. 1 krok 7.
// Telemetria (It. 1): zapis robi skrypt po runie (hook Stop), nie agent — agent haiku dwa razy skasowal wspolny plik,
// a budget.spent() liczy tylko tokeny wyjsciowe (~11% kosztu; decyzja O3: usunac wszystkie trzy liczniki).

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
const { podsumujKontroleFixa } = new Function(
  `${wytnij('function podsumujKontroleFixa(', '\n}', 'podsumujKontroleFixa')}
   return { podsumujKontroleFixa }`,
)()

// ── Telemetria It. 1: bez agenta i bez budget.spent() ─────────────────────
// Strażnik regresji na zrodle — skryptu workflowu nie da sie uruchomic w tescie (wymaga runtime'u Workflow).

test('orkiestrator nie powoluje agenta telemetrii', () => {
  assert.doesNotMatch(zrodlo, /label: `telemetria:/, 'zapis telemetrii robi zbierz.mjs z hooka Stop, nie agent w runie')
  assert.doesNotMatch(zrodlo, /autopilot-runs\.jsonl/, 'stary plik telemetrii nie jest juz zapisywany z workflowu')
})

test('orkiestrator nie liczy tokenow z budget.spent() — koszt tylko z telemetrii (pelny cennik)', () => {
  assert.doesNotMatch(zrodlo, /budget\.spent/)
  assert.doesNotMatch(zrodlo, /tokenyEtapy|tokenyRazemK/)
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

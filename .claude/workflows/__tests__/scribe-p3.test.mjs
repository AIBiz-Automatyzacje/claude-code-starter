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

/** @typedef {{ e2eStatus: string, e2eTryb: string, e2ePrzebiegi: unknown[], e2eTesterFail: boolean, e2eWykonany: boolean }} PrzebiegScribe */
/** @type {{ scribePrompt: (sciezka: string, faza: number, potwierdzone: unknown[], przebieg: PrzebiegScribe, obalone: unknown[], bezKsiegowaniaE2e?: boolean) => string, BLOK_LIMIT_P3: string }} */
// P14: scribe dostaje polecenie ksiegowania [E2E] z komendaKsiegowania (atrapa — kontrakt w e2e-manual.test.mjs).
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { scribePrompt, BLOK_LIMIT_P3 } = new Function('przebiegBlok', 'komendaKsiegowania',
  `${wytnij('function scribePrompt(', '\n}')}
   ${wytnij('const BLOK_LIMIT_P3 = `', '=== KONIEC BLOKU LIMITU P3 ===`')}
   return { scribePrompt, BLOK_LIMIT_P3 }`,
)(() => '## Przebieg review', () => 'node .claude/scripts/e2e/e2e.mjs ksieguj')

/** @type {PrzebiegScribe} */
const PRZEBIEG = { e2eStatus: 'pominiety', e2eTryb: 'pominiety', e2ePrzebiegi: [], e2eTesterFail: false, e2eWykonany: true }
const prompt = scribePrompt('docs/active/x', 4, [], PRZEBIEG, [])

test('scribe: P3 typu KOD/TEST ida do known-issues, sekcja "## P3 faza N", dopisanie bez duplikatow', () => {
  assert.match(prompt, /docs\/active\/x\/known-issues\.md/)
  assert.match(prompt, /## P3 faza 4/)
  assert.match(prompt, /bez duplikatow/i)
  assert.match(prompt, /nie usuwaj/i, 'powtorka review po STOP-ie nie moze skasowac P3 z przerwanego podejscia')
})

test('scribe: "Do poprawy" to P1 i P2 — P3 nie ida do fixa', () => {
  assert.match(prompt, /"## Do poprawy po review fazy 4"\n\s+— wylistuj findingi typu KOD\/TEST\/E2E o severity P1 i P2 jako checkbox/)
  assert.doesNotMatch(prompt, /ORAZ findingi P3|agentowi fixa razem z P1\/P2/)
})

// D12 (IU-1.8): bloker srodowiska z polityka stop-rebuild zatrzymuje run przed zamknieciem review — scribe nie ksieguje
// linii [E2E] (powtorka review po przebudowie odegra je od nowa); bez blokera polecenie ksiegowania jak dotad.
test('scribe: przy blokerze stop-rebuild linii [E2E] nie ksieguje; bez niego dostaje komende ksiegowania', () => {
  const zTesterem = { ...PRZEBIEG, e2eStatus: 'wykonany', e2eTryb: 'interaktywny' }
  assert.match(scribePrompt('docs/active/x', 4, [], zTesterem, []), /e2e\.mjs ksieguj/)
  const stop = scribePrompt('docs/active/x', 4, [], zTesterem, [], true)
  assert.doesNotMatch(stop, /e2e\.mjs ksieguj/)
  assert.match(stop, /wymaga przebudowy[^\n]*linii \[E2E\] nie ruszasz/)
})

// Punkt 35: status „nie odegrano” (same SKIP testera interaktywnego) trafia do raportu review przez polecenie scribe'a,
// a ksiegowanie linii [E2E] zostaje — SKIP-y nadal ida na [Manual] skryptem.
test('scribe: status E2E „nie odegrano” jest w poleceniu, ksiegowanie bez zmian', () => {
  const nieOdegrano = { ...PRZEBIEG, e2eStatus: 'nie odegrano (tryb interaktywny) — zaden z 2 scenariuszy nie ma PASS ani FAIL', e2eTryb: 'interaktywny' }
  const polecenie = scribePrompt('docs/active/x', 4, [], nieOdegrano, [])
  assert.match(polecenie, /JEDYNY dowod PASS — tester: nie odegrano \(tryb interaktywny\) — zaden z 2 scenariuszy nie ma PASS ani FAIL\)/)
  assert.match(polecenie, /e2e\.mjs ksieguj/)
})

// Pilot Nawykometr W18 (runy 1 i 3): naglowek raportu mial „Gate: BLOKUJE” (stan z review), a wynik autopilota dla tej samej
// fazy „gate: CZYSTE” (stan po cyklu fix) — dwa rozne werdykty pod jedna nazwa w archiwum zadania.
test('scribe: werdykt w naglowku raportu jest nazwany jako gate review sprzed fixa', () => {
  assert.match(prompt, /Werdykt w naglowku: "Gate review \(przed fixem\): <severityGate>" — gate fazy po cyklu fix podaje wynik autopilota\./)
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

// E5-2(b): /dev-pr pyta przed PR o P3 osi correctness/security z known-issues — linia musi niesc os (pole _zrodlo findingu).
test('scribe: linia P3 w known-issues niesie os reviewera ([P3/<os>] z pola _zrodlo)', () => {
  assert.match(prompt, /- 🟡 \[P3\/<os>\] <plik:linia> — <opis>/)
  assert.match(prompt, /os = pole _zrodlo findingu/)
})

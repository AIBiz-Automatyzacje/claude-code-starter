// Domkniecie fazy w dev-docs-execute-wf.js uruchamia skrypt bramek (PLAN-POPRAWY P6): baza fazy z plannera, naprawa
// porazek bez "grania lintera", ostrzezenia ESLint, przezyte mutanty i testy usuniete w EXECUTE_RESULT (wejscie review
// i telemetrii faza.bramki / faza.testy_usuniete), suma migracji po naprawie; krok Dziennika bez archeologii (H51).

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-docs-execute-wf.js'), 'utf8')
const skryptBramek = readFileSync(resolve(KATALOG, '../../scripts/bramki/bramki.mjs'), 'utf8')

/** @param {string} kotwica @param {string} koniec @returns {string} */
function wytnij(kotwica, koniec) {
  const start = zrodlo.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = zrodlo.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return zrodlo.slice(start, stop + koniec.length)
}

// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const wf = new Function(
  `${wytnij('const BLOK_DLUGIE_KOMENDY', '=== KONIEC BLOKU DLUGICH KOMEND ===`')}
   ${wytnij('const IU_PLAN = {', '\n}')}
   ${wytnij('const NAZWY_BRAMEK', "required: ['fazaNumer', 'status', 'iu'],\n}")}
   ${wytnij('function bazaFazy(', '\n}')}
   ${wytnij('function domknieciePrompt(', '\n}')}
   return { IU_PLAN, EXECUTE_RESULT, bazaFazy, domknieciePrompt }`,
)()

const SHA = '0123456789abcdef0123456789abcdef01234567'
const prompt = wf.domknieciePrompt('docs/active/x', 2, [{ id: 'IU-1', status: 'completed' }], SHA)

// Nazwy bramek z kolejki skryptu: ['typecheck', () => ...]
const NAZWY_BRAMEK = [...skryptBramek.matchAll(/^\s+\['(\w+)', \(\) =>/gm)].map((m) => m[1])

test('planner zwraca baze fazy (HEAD przed builderami); JS bierze ja tylko jako SHA, inaczej HEAD domkniecia', () => {
  assert.ok(wf.IU_PLAN.required.includes('baza'))
  assert.equal(wf.bazaFazy({ baza: SHA }), SHA)
  assert.equal(wf.bazaFazy({ baza: 'abc1234' }), 'abc1234')
  assert.equal(wf.bazaFazy({ baza: 'HEAD; rm -rf /' }), 'HEAD')
  assert.equal(wf.bazaFazy({}), 'HEAD')
  assert.match(zrodlo, /domknieciePrompt\(sciezka, faza, buildResults, bazaFazy\(plan\)\)/)
})

test('domkniecie uruchamia bramki z baza fazy, naprawia porazki bez wlasnego lintu, po naprawie dopisuje sume migracji', () => {
  assert.ok(prompt.includes(`node .claude/scripts/bramki/bramki.mjs --baza ${SHA}`))
  assert.ok(prompt.includes('node .claude/scripts/bramki/bramki.mjs --dopisz-sume'))
  assert.match(prompt, /Nie uruchamiaj ESLint/)
  assert.match(prompt, /eslint-disable/)
  assert.ok(prompt.indexOf('--baza') < prompt.indexOf('--dopisz-sume'), 'suma migracji po bramkach i naprawie')
  assert.match(prompt, /AUDYT ERROR-HANDLINGU/, 'pkt 1b zostaje (PLAN-POPRAWY P6)')
})

test('krok Dziennika bez archeologii dat (H51)', () => {
  assert.doesNotMatch(prompt, /od 2026-09-03/)
  assert.match(prompt, /te tresci zyja w planie technicznym/)
})

test('EXECUTE_RESULT: bramki z kazda bramka skryptu, ostrzezenia ESLint, mutanty i testy usuniete z uzasadnieniem', () => {
  assert.equal(NAZWY_BRAMEK.length, 10)
  const p = wf.EXECUTE_RESULT.properties
  assert.deepEqual(Object.keys(p.bramki.properties), NAZWY_BRAMEK)
  assert.deepEqual(p.bramki.properties.eslint.required, ['status', 'sekundy', 'trafienia'])
  for (const pole of ['ostrzezeniaEslint', 'mutanty']) assert.deepEqual(p[pole].items.required, ['plik', 'linia', 'regula', 'opis'])
  assert.deepEqual(p.testyUsuniete.items.required, ['plik', 'nazwa', 'uzasadnienie'])
  for (const pole of ['bramki', 'ostrzezeniaEslint', 'mutanty', 'testyUsuniete']) assert.match(prompt, new RegExp(`\\b${pole}\\b`))
})

// Domkniecie fazy w dev-docs-execute-wf.js uruchamia skrypt bramek (PLAN-POPRAWY P6): baza fazy z plannera, naprawa
// porazek bez "grania lintera", testy usuniete w EXECUTE_RESULT (telemetria faza.bramki / faza.testy_usuniete), suma
// migracji po naprawie; krok Dziennika bez archeologii (H51). Po commicie skrypt dossier (P7): wynik bramek z OSTATNIEGO
// przebiegu (ostrzezenia ESLint, knip, mutanty) idzie do review przez dossier, pole dossier w schemacie KONTEKST review-wf.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { sciezkiArtefaktow } from '../../scripts/dossier/sciezki.mjs'

const KATALOG = dirname(fileURLToPath(import.meta.url))
const zrodlo = readFileSync(resolve(KATALOG, '../dev-docs-execute-wf.js'), 'utf8')
const skryptBramek = readFileSync(resolve(KATALOG, '../../scripts/bramki/bramki.mjs'), 'utf8')
const zrodloReview = readFileSync(resolve(KATALOG, '../dev-docs-review-wf.js'), 'utf8')

/** @param {string} kotwica @param {string} koniec @param {string} [z] @returns {string} */
function wytnij(kotwica, koniec, z = zrodlo) {
  const start = z.indexOf(kotwica)
  assert.notEqual(start, -1, `nie znaleziono "${kotwica}" — kotwica testu wymaga aktualizacji`)
  const stop = z.indexOf(koniec, start)
  assert.notEqual(stop, -1, `nie znaleziono konca fragmentu od "${kotwica}"`)
  return z.slice(start, stop + koniec.length)
}

// eslint-disable-next-line no-new-func -- ekstrakcja z pliku workflowu tego repo, nie z inputu
const wf = new Function(
  `${wytnij('const BLOK_DLUGIE_KOMENDY', '=== KONIEC BLOKU DLUGICH KOMEND ===`')}
   ${wytnij('const IU_PLAN = {', '\n}')}
   ${wytnij('const NAZWY_BRAMEK', "required: ['fazaNumer', 'status', 'iu', 'stanZapisany'],\n}")}
   ${wytnij('function bazaFazy(', '\n}')}
   ${wytnij('function plikBramek(', '\n}')}
   ${wytnij('function domknieciePrompt(', '\n}')}
   return { IU_PLAN, EXECUTE_RESULT, bazaFazy, plikBramek, domknieciePrompt }`,
)()
// eslint-disable-next-line no-new-func -- ekstrakcja schematu z pliku workflowu tego repo, nie z inputu
const KONTEKST = new Function(`${wytnij('const KONTEKST = {', "\n  required: ['pliki', 'warstwy', 'e2eCheckboxy'],\n}", zrodloReview)}\nreturn KONTEKST`)()

const SHA = '0123456789abcdef0123456789abcdef01234567'
const PLIK_BRAMEK = wf.plikBramek('docs/active/x', 2)
const prompt = wf.domknieciePrompt('docs/active/x', 2, [{ id: 'IU-1', status: 'completed' }], SHA, PLIK_BRAMEK)

// Nazwy bramek z kolejki skryptu: ['typecheck', () => ...]
const NAZWY_BRAMEK = [...skryptBramek.matchAll(/^\s+\['(\w+)', \(\) =>/gm)].map((m) => m[1])

test('planner zwraca baze fazy (HEAD przed builderami); JS bierze ja tylko jako SHA, inaczej HEAD domkniecia', () => {
  assert.ok(wf.IU_PLAN.required.includes('baza'))
  assert.equal(wf.bazaFazy({ baza: SHA }), SHA)
  assert.equal(wf.bazaFazy({ baza: 'abc1234' }), 'abc1234')
  assert.equal(wf.bazaFazy({ baza: 'HEAD; rm -rf /' }), 'HEAD')
  assert.equal(wf.bazaFazy({}), 'HEAD')
  assert.match(zrodlo, /domknieciePrompt\(sciezka, faza, buildResults, bazaFazy\(plan\), plikBramek\(sciezka, faza\)\)/)
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

// Zmiana kontraktu (P7): ostrzezeniaEslint i mutanty wychodza z EXECUTE_RESULT — do review ida przez dossier, z ostatniego
// przebiegu bramek (HANDOFF 6a pkt 52 e: domkniecie wpisywalo do mutanty drugi przebieg, choc prompt mowil o pierwszym).
test('EXECUTE_RESULT: bramki z kazda bramka skryptu i testy usuniete z uzasadnieniem; bez ostrzezen i mutantow', () => {
  assert.equal(NAZWY_BRAMEK.length, 10)
  const p = wf.EXECUTE_RESULT.properties
  assert.deepEqual(Object.keys(p.bramki.properties), NAZWY_BRAMEK)
  assert.deepEqual(p.bramki.properties.eslint.required, ['status', 'sekundy', 'trafienia'])
  assert.deepEqual(p.testyUsuniete.items.required, ['plik', 'nazwa', 'uzasadnienie'])
  for (const pole of ['bramki', 'testyUsuniete', 'dossier']) assert.match(prompt, new RegExp(`\\b${pole}\\b`))
  for (const pole of ['ostrzezeniaEslint', 'mutanty']) {
    assert.ok(!(pole in p), `${pole} idzie do review przez dossier, nie przez EXECUTE_RESULT`)
    assert.doesNotMatch(prompt, new RegExp(`\\b${pole}\\b`))
  }
})

test('bramki zapisuja wynik do pliku artefaktow fazy; kazdy przebieg go nadpisuje (dossier bierze ostatni)', () => {
  assert.equal(PLIK_BRAMEK, sciezkiArtefaktow('/tmp', 'docs/active/x', 2).bramki, 'ten sam wzor nazwy co .claude/scripts/dossier/sciezki.mjs')
  assert.ok(prompt.includes(`node .claude/scripts/bramki/bramki.mjs --baza ${SHA} > ${PLIK_BRAMEK}`))
  assert.match(prompt, /jeszcze raz ta sama komenda/)
})

test('dossier po commicie fazy z baza i plikiem bramek; pole dossier w schemacie KONTEKST review-wf, null gdy skrypt padl', () => {
  const komenda = `node .claude/scripts/dossier/dossier.mjs --sciezka docs/active/x --faza 2 --baza ${SHA} --bramki ${PLIK_BRAMEK}`
  assert.ok(prompt.includes(komenda))
  assert.ok(prompt.indexOf('Commit inkrementalny') < prompt.indexOf(komenda), 'dossier liczy diff po commicie fazy')
  const d = wf.EXECUTE_RESULT.properties.dossier
  assert.deepEqual(d.type, ['object', 'null'])
  assert.deepEqual(d.properties, KONTEKST.properties)
  assert.deepEqual(d.required, KONTEKST.required)
  assert.ok(!wf.EXECUTE_RESULT.required.includes('dossier'))
})

test('dossier bez bazy z plannera: bez --baza (HEAD po commicie dalby pusty diff) — skrypt bierze merge-base', () => {
  const bezBazy = wf.domknieciePrompt('docs/active/x', 2, [], 'HEAD', PLIK_BRAMEK)
  assert.ok(bezBazy.includes(`node .claude/scripts/dossier/dossier.mjs --sciezka docs/active/x --faza 2 --bramki ${PLIK_BRAMEK}`))
})

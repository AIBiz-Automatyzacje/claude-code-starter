// Testy dev-autopilot-wf.js: fix naprawia tylko P1/P2, P3 zostaja w known-issues (PLAN-POPRAWY P8, „Fix tylko P1/P2”).
//
// Uruchomienie:  node --test .claude/workflows/__tests__/fix-p1-p2.test.mjs
//
// Fix naprawial 98% findingow lacznie z P3 (138 z 225), a po fixie nie ma re-review. Od P8 lista fixa ma tylko P1/P2,
// P3 zapisuje scribe do known-issues; stan sprzed P8 z P3 na liscie fixa przenosi do known-issues orkiestrator.

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

/** @typedef {import('./typy.mjs').Finding} Finding */

// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { FIX_RESULT, fixPrompt } = new Function('BLOK_DLUGIE_KOMENDY', 'POLE_STANU',
  `${wytnij('function blokZwinieciaDoPoprawy(', '\n}', 'blokZwinieciaDoPoprawy')}
   ${wytnij('function fixPrompt(', '\n}', 'fixPrompt')}
   ${wytnij('const FIX_RESULT = {', '\n}', 'FIX_RESULT')}
   return { FIX_RESULT, fixPrompt }`,
)('', {})

/** @type {Finding[]} */
const LISTA = [
  { severity: 'P1', typ: 'KOD', plik: 'a.ts:1', opis: 'defekt' },
  { severity: 'P2', typ: 'TEST', plik: 'b.test.ts:2', opis: 'brak testu' },
]

test('FIX_RESULT nie ma pola p3Pominiete — fix nie dostaje P3, wiec nie ma czego pomijac', () => {
  assert.equal('p3Pominiete' in FIX_RESULT.properties, false)
  assert.equal(FIX_RESULT.required.includes('p3Pominiete'), false)
})

test('fixPrompt: lista fixa to P1 i P2, P3 sa w known-issues i nie sa do naprawy', () => {
  const p = fixPrompt('docs/active/x', 2, LISTA)
  assert.doesNotMatch(p, /p3Pominiete|napraw albo uzasadnij/)
  assert.match(p, /lista zawiera P1 i P2/i)
  assert.match(p, /P3 z tej fazy sa w docs\/active\/x\/known-issues\.md/)
})

test('zwiniecie "Do poprawy" nie kieruje P3 do smoke\'u operatora', () => {
  const p = fixPrompt('docs/active/x', 2, LISTA)
  assert.doesNotMatch(p, /P3 do smoke/)
})

// ── Stan sprzed P8: P3 na liscie fixa → known-issues ──────────────────────

/** @typedef {{ numer: number, review: string, fix: string, otwarteFindingi: Finding[] }} FazaStanu */
/** @type {{ odlozP3ZeStanu: (fazy: FazaStanu[]) => { fazy: FazaStanu[], odlozone: Array<{ faza: number, findingi: Finding[] }> }, p3KnownIssuesPrompt: (sciezka: string, odlozone: Array<{ faza: number, findingi: Finding[] }>) => string }} */
// eslint-disable-next-line no-new-func -- ekstrakcja funkcji z pliku workflowu tego repo, nie z inputu
const { odlozP3ZeStanu, p3KnownIssuesPrompt } = new Function('instrukcjaCommita',
  `${wytnij('function odlozP3ZeStanu(', '\n}', 'odlozP3ZeStanu')}
   ${wytnij('function p3KnownIssuesPrompt(', '\n}', 'p3KnownIssuesPrompt')}
   return { odlozP3ZeStanu, p3KnownIssuesPrompt }`,
)((/** @type {string} */ temat) => `git commit -m "${temat}"`)

/** @type {(severity: string, plik: string) => Finding} */
const fnd = (severity, plik) => ({ severity, typ: 'KOD', plik, opis: `opis ${plik}` })

test('odlozP3ZeStanu: P3 wychodza z listy fixa, P1/P2 zostaja, faza z samymi P3 nie ma fixa', () => {
  /** @type {FazaStanu[]} */
  const fazy = [
    { numer: 5, review: 'done', fix: 'pending', otwarteFindingi: [fnd('P1', 'a.ts:1'), fnd('P3', 'b.ts:2')] },
    { numer: 6, review: 'done', fix: 'pending', otwarteFindingi: [fnd('P3', 'c.ts:3'), fnd('P3', 'd.ts:4')] },
    { numer: 7, review: 'pending', fix: 'none', otwarteFindingi: [fnd('P3', 'e.ts:5')] },
    { numer: 8, review: 'pending', fix: 'none', otwarteFindingi: [] },
  ]
  const kopia = structuredClone(fazy)
  const { fazy: po, odlozone } = odlozP3ZeStanu(fazy)

  assert.deepEqual(po.map((f) => f.otwarteFindingi.map((x) => x.plik)), [['a.ts:1'], [], [], []])
  assert.deepEqual(po.map((f) => f.fix), ['pending', 'none', 'none', 'none'], 'faza po review bez P1/P2 nie ma czego naprawiac')
  assert.deepEqual(odlozone.map((o) => [o.faza, o.findingi.map((x) => x.plik)]), [[5, ['b.ts:2']], [6, ['c.ts:3', 'd.ts:4']], [7, ['e.ts:5']]])
  assert.deepEqual(fazy, kopia, 'stan zmienia sie dopiero po zapisie known-issues — wejscie nietkniete')
})

test('odlozP3ZeStanu: stan bez P3 wraca bez zmian i bez pozycji do zapisu', () => {
  /** @type {FazaStanu[]} */
  const fazy = [{ numer: 1, review: 'done', fix: 'pending', otwarteFindingi: [fnd('P2', 'a.ts:1')] }]
  const { fazy: po, odlozone } = odlozP3ZeStanu(fazy)
  assert.deepEqual(po, fazy)
  assert.deepEqual(odlozone, [])
})

test('p3KnownIssuesPrompt: sekcja "## P3 faza N" z kazdym findingiem, dopisanie bez duplikatow, commit pliku', () => {
  const p = p3KnownIssuesPrompt('docs/active/x', [{ faza: 6, findingi: [fnd('P3', 'c.ts:3')] }])
  assert.match(p, /## P3 faza 6\n/)
  assert.match(p, /- 🟡 \[P3\] c\.ts:3 — opis c\.ts:3/)
  assert.match(p, /docs\/active\/x\/known-issues\.md/)
  assert.match(p, /bez duplikatow/i)
  assert.match(p, /git add docs\/active\/x\/known-issues\.md/)
})

test('wiring: P3 ze stanu ida do known-issues przed kolejka faz; stan zmienia sie dopiero po zapisie, porazka = STOP', () => {
  const poBootstrapie = zrodlo.slice(zrodlo.indexOf("label: 'bootstrap'"))
  const iOdloz = poBootstrapie.indexOf('odlozP3ZeStanu(stan.fazy)')
  const iKolejka = poBootstrapie.indexOf('kolejka = stan.fazy')
  assert.ok(iOdloz > 0 && iOdloz < iKolejka, 'przeniesienie P3 musi poprzedzac kolejke — faza z samymi P3 nie moze trafic do fixa')
  const blok = poBootstrapie.slice(iOdloz, iKolejka)
  assert.match(blok, /agentType: 'klasa-mechaniczny', label: 'start:p3-known-issues'/)
  assert.match(blok, /return await stopRun\(/)
  assert.ok(blok.indexOf('stopRun(') < blok.indexOf('stan.fazy = '), 'stan bez P3 dopiero po potwierdzonym zapisie known-issues')
})

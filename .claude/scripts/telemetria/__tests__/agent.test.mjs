// Test rekordu `agent` i przypisania agenta do fazy (It. 1, krok 1).
// Rekord: d5-telemetria-rekord.txt §2 + §7 + §8 + §10. Faza: §8 pkt 7 (najblizsza wczesniejsza grupa „Faza N”).

import test from 'node:test'
import assert from 'node:assert/strict'

import { rekordAgenta } from '../agent.mjs'
import { agenciHarnessu, fazyAgentow } from '../harness.mjs'
import { analizujTranskrypt } from '../transkrypt.mjs'

const POSTEP = [
  { type: 'workflow_phase', index: 1, title: 'Bootstrap' },
  { type: 'workflow_phase', index: 2, title: 'Zakonczenie' },
  { type: 'workflow_phase', index: 3, title: 'Faza 1' },
  { type: 'workflow_phase', index: 4, title: '▸ dev-docs-execute-wf', kind: 'child' },
  { type: 'workflow_phase', index: 5, title: '▸ dev-docs-review-wf', kind: 'child' },
  { type: 'workflow_phase', index: 6, title: 'Faza 2' },
  { type: 'workflow_phase', index: 7, title: '▸ dev-docs-review-wf #2', kind: 'child' },
  { type: 'workflow_phase', index: 8, title: '▸ dev-compound-wf', kind: 'child' },
  { type: 'workflow_agent', agentId: 'a-boot', label: 'bootstrap', phaseIndex: 1, phaseTitle: 'Bootstrap', attempt: 1, state: 'done', model: 'claude-opus-5-5' },
  { type: 'workflow_agent', agentId: 'a-rev1', label: 'review:security', phaseIndex: 5, phaseTitle: '▸ dev-docs-review-wf', attempt: 1, state: 'done', agentType: 'security-sentinel' },
  { type: 'workflow_agent', agentId: 'a-fix2', label: 'fix:faza-2', phaseIndex: 6, phaseTitle: 'Faza 2', attempt: 2, state: 'error' },
  { type: 'workflow_agent', agentId: 'a-rev2', label: 'verify-batch:src/a.ts:2', phaseIndex: 7, phaseTitle: '▸ dev-docs-review-wf #2', attempt: 1, state: 'done' },
  { type: 'workflow_agent', agentId: 'a-cmp', label: 'compound', phaseIndex: 8, phaseTitle: '▸ dev-compound-wf', attempt: 1, state: 'done' },
]

test('faza agenta: grupa „Faza N”, dziecko execute/review po najblizszej wczesniejszej fazie, reszta = poziom runu', () => {
  const fazy = fazyAgentow(POSTEP)
  assert.equal(fazy.get('a-boot'), null)
  assert.equal(fazy.get('a-rev1'), 1)
  assert.equal(fazy.get('a-fix2'), 2)
  assert.equal(fazy.get('a-rev2'), 2, '„#2” w nazwie grupy to numer wywolania — faze wyznacza grupa „Faza 2” przed nia')
  assert.equal(fazy.get('a-cmp'), null, 'compound biegnie w zakonczeniu, nie w ostatniej fazie')
})

test('wpis harnessu: etykieta, grupa, proba, stan, agentType', () => {
  const a = agenciHarnessu(POSTEP).get('a-fix2')
  assert.deepEqual(a, { etykieta: 'fix:faza-2', grupa: 'Faza 2', proba: 2, stan: 'error', model: null, agentType: null })
})

const TRANSKRYPT = [
  { type: 'user', message: { content: 'Jestes reviewerem fazy 1.' } },
  {
    type: 'assistant', timestamp: '2026-09-23T10:00:00.000Z', effort: 'high', version: '2.1.283',
    message: { id: 'm1', model: 'claude-opus-5-5', content: [], usage: { input_tokens: 1, cache_creation_input_tokens: 100, cache_read_input_tokens: 0, output_tokens: 10 } },
  },
]

/** @param {Partial<Parameters<typeof rekordAgenta>[0]>} nadpisz */
const zbuduj = (nadpisz) =>
  rekordAgenta({
    id: 'a-rev1',
    meta: { agentType: 'security-sentinel', description: 'review:security', workflowPhase: '▸ dev-docs-review-wf' },
    harness: agenciHarnessu(POSTEP).get('a-rev1') ?? null,
    journal: { rozpoczety: true, maWynik: true, wynik: { findings: [{ severity: 'P1' }, { severity: 'P2' }, { severity: 'P2' }, { severity: 'P3' }] } },
    analiza: analizujTranskrypt(TRANSKRYPT),
    faza: 1,
    ...nadpisz,
  })

test('rekord reviewera: rola, klasa, efort, koszt i findingi per waga', () => {
  const r = zbuduj({})
  assert.equal(r.typ, 'agent')
  assert.equal(r.rola, 'review:security')
  assert.equal(r.klasa_roli, 'reviewer')
  assert.equal(r.agentType, 'security-sentinel')
  assert.equal(r.effort, 'high')
  assert.equal(r.faza, 1)
  assert.equal(r.proba, 1)
  assert.equal(r.wynik, 'ok')
  assert.deepEqual(r.findingi, { p1: 1, p2: 2, p3: 1 })
  assert.equal(r.koszt_jedn, 1 + 125 + 50)
})

test('wynik agenta: null z journala, brak wyniku = przerwany, stan error = blad', () => {
  assert.equal(zbuduj({ journal: { rozpoczety: true, maWynik: true, wynik: null } }).wynik, 'null')
  assert.equal(zbuduj({ journal: { rozpoczety: true, maWynik: false, wynik: null } }).wynik, 'brak')
  const harnessBlad = { etykieta: 'review:security', grupa: 'x', proba: 1, stan: 'error', model: null, agentType: null }
  assert.equal(zbuduj({ harness: harnessBlad, journal: { rozpoczety: true, maWynik: false, wynik: null } }).wynik, 'blad')
})

test('sceptyk batch: weryfikowane i obalone z listy werdyktow', () => {
  const r = zbuduj({
    meta: { description: 'verify-batch:src/a.ts:3' },
    harness: null,
    journal: { rozpoczety: true, maWynik: true, wynik: { werdykty: [{ realny: true }, { realny: false }, { realny: false }] } },
  })
  assert.equal(r.klasa_roli, 'sceptyk')
  assert.equal(r.weryfikowane, 3)
  assert.equal(r.obalone, 2)
  assert.equal(r.findingi, null, 'findingi tylko u reviewerow i testera')
})

test('sceptyk P1: pojedynczy werdykt', () => {
  const r = zbuduj({ meta: { description: 'verify:src/a.ts:0' }, harness: null, journal: { rozpoczety: true, maWynik: true, wynik: { realny: false } } })
  assert.equal(r.weryfikowane, 1)
  assert.equal(r.obalone, 1)
})

test('stary run bez etykiety: rola z promptu', () => {
  const r = zbuduj({ meta: {}, harness: null })
  assert.equal(r.etykieta, null)
  assert.equal(r.rola, 'review:?')
})

test('pola z producentem w pozniejszych iteracjach istnieja jako null', () => {
  const r = zbuduj({})
  const pola = new Map(Object.entries(r))
  for (const pole of ['instrukcje_stale', 'werdykty']) assert.ok(pola.has(pole) && pola.get(pole) === null, pole)
})

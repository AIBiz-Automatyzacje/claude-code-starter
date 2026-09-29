// Test odczytu zrodel z dysku (It. 1, krok 1): runy, journal, rekordy agentow jednego runu.
// Fixture budowany w katalogu tymczasowym — ten sam uklad co ~/.claude/projects (przeglad D5 §1).

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { agenciRunu, czytajJournal, czytajJsonl, znajdzRuny } from '../zrodla.mjs'

/** @param {unknown[]} wpisy */
const jsonl = (wpisy) => wpisy.map((w) => JSON.stringify(w)).join('\n') + '\n'

/** @param {string} id @param {number} out */
const transkrypt = (id, out) => jsonl([
  { type: 'user', message: { content: 'Jestes reviewerem fazy 1.' } },
  { type: 'assistant', timestamp: '2026-09-23T10:00:00.000Z', effort: 'high', message: { id, model: 'claude-opus-5-5', content: [], usage: { input_tokens: 1, cache_creation_input_tokens: 100, cache_read_input_tokens: 0, output_tokens: out } } },
])

function zbudujFixture() {
  const katalog = mkdtempSync(join(tmpdir(), 'telemetria-zrodla-'))
  const sesja = join(katalog, '-Users-u-Kodowanie-projekt', 'sesja-1')
  const run = join(sesja, 'subagents', 'workflows', 'wf_aaa-111')
  mkdirSync(run, { recursive: true })
  mkdirSync(join(sesja, 'workflows'), { recursive: true })
  writeFileSync(join(run, 'journal.jsonl'), jsonl([
    { type: 'launched' },
    { type: 'started', agentId: 'a1', label: 'review:security', phase: '▸ dev-docs-review-wf' },
    { type: 'result', agentId: 'a1', result: { findings: [{ severity: 'P2' }] } },
    { type: 'started', agentId: 'a2', label: 'scribe', phase: '▸ dev-docs-review-wf' },
  ]) + '{uszkodzona linia\n')
  writeFileSync(join(run, 'agent-a1.meta.json'), JSON.stringify({ agentType: 'security-sentinel', description: 'review:security' }))
  writeFileSync(join(run, 'agent-a1.jsonl'), transkrypt('m1', 10))
  writeFileSync(join(run, 'agent-a2.meta.json'), JSON.stringify({ description: 'scribe' }))
  writeFileSync(join(run, 'agent-a2.jsonl'), transkrypt('m2', 20))
  writeFileSync(join(sesja, 'workflows', 'wf_aaa-111.json'), JSON.stringify({
    runId: 'wf_aaa-111', status: 'completed', workflowName: 'dev-autopilot-wf',
    workflowProgress: [
      { type: 'workflow_phase', index: 1, title: 'Faza 1' },
      { type: 'workflow_phase', index: 2, title: '▸ dev-docs-review-wf', kind: 'child' },
      { type: 'workflow_agent', agentId: 'a1', label: 'review:security', phaseIndex: 2, phaseTitle: '▸ dev-docs-review-wf', attempt: 1, state: 'done' },
      { type: 'workflow_agent', agentId: 'a2', label: 'scribe', phaseIndex: 2, phaseTitle: '▸ dev-docs-review-wf', attempt: 1, state: 'progress' },
    ],
  }))
  // Run w toku: katalog agentow jest, pliku harnessu jeszcze nie ma.
  mkdirSync(join(sesja, 'subagents', 'workflows', 'wf_bbb-222'), { recursive: true })
  return katalog
}

test('znajdzRuny: kazdy katalog wf_ z projektem, sesja i plikiem harnessu albo null', () => {
  const katalog = zbudujFixture()
  try {
    const runy = znajdzRuny(katalog)
    assert.deepEqual(runy.map((r) => [r.run, r.sesja, r.projektSlug, r.plikHarnessu !== null]), [
      ['wf_aaa-111', 'sesja-1', '-Users-u-Kodowanie-projekt', true],
      ['wf_bbb-222', 'sesja-1', '-Users-u-Kodowanie-projekt', false],
    ])
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

test('czytajJsonl pomija uszkodzona linie i ja liczy', () => {
  const katalog = zbudujFixture()
  try {
    const run = znajdzRuny(katalog)[0]
    const { wpisy, uszkodzone } = czytajJsonl(join(run.katalogRunu, 'journal.jsonl'))
    assert.equal(wpisy.length, 4)
    assert.equal(uszkodzone, 1)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

test('czytajJournal: agent z wynikiem i agent przerwany (started bez result)', () => {
  const katalog = zbudujFixture()
  try {
    const j = czytajJournal(znajdzRuny(katalog)[0].katalogRunu)
    assert.deepEqual(j.get('a1'), { rozpoczety: true, maWynik: true, wynik: { findings: [{ severity: 'P2' }] } })
    assert.deepEqual(j.get('a2'), { rozpoczety: true, maWynik: false, wynik: null })
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

test('agenciRunu: rekord na kazdy transkrypt, z faza z pliku harnessu', () => {
  const katalog = zbudujFixture()
  try {
    const agenci = agenciRunu(znajdzRuny(katalog)[0])
    const a1 = agenci.find((a) => a.id === 'a1')
    const a2 = agenci.find((a) => a.id === 'a2')
    assert.equal(agenci.length, 2)
    assert.equal(a1?.faza, 1)
    assert.deepEqual(a1?.findingi, { p1: 0, p2: 1, p3: 0 })
    assert.equal(a1?.agentType, 'security-sentinel')
    assert.equal(a2?.wynik, 'brak')
    assert.equal(a2?.out, 20)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

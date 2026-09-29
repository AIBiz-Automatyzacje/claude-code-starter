// Fixture katalogu ~/.claude/projects dla testow telemetrii — ten sam uklad co u Claude Code (przeglad D5 §1).
// Budowany w katalogu tymczasowym; wywolujacy sprzata (`rmSync`).

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const CWD_PROJEKTU = '/Users/u/Kodowanie/projekt'

/** @param {unknown[]} wpisy */
export const jsonl = (wpisy) => wpisy.map((w) => JSON.stringify(w)).join('\n') + '\n'

/** @param {string} id @param {number} out */
export const transkrypt = (id, out) => jsonl([
  { type: 'user', cwd: CWD_PROJEKTU, message: { content: 'Jestes reviewerem fazy 1.' } },
  { type: 'assistant', cwd: CWD_PROJEKTU, timestamp: '2026-09-23T10:00:00.000Z', effort: 'high', message: { id, model: 'claude-opus-5-5', content: [], usage: { input_tokens: 1, cache_creation_input_tokens: 100, cache_read_input_tokens: 0, output_tokens: out } } },
])

/**
 * Jeden projekt, jedna sesja: run wf_aaa-111 zakonczony (plik harnessu) i run wf_bbb-222 bez pliku harnessu.
 * @returns {string} katalog projektow
 */
export function zbudujFixture() {
  const katalog = mkdtempSync(join(tmpdir(), 'telemetria-projekty-'))
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
    runId: 'wf_aaa-111', status: 'completed', workflowName: 'dev-docs-review-wf', durationMs: 60000,
    args: { sciezka: 'docs/active/zadanie-x', faza: 1 },
    result: { status: 'OK' },
    workflowProgress: [
      { type: 'workflow_phase', index: 1, title: 'Faza 1' },
      { type: 'workflow_phase', index: 2, title: '▸ dev-docs-review-wf', kind: 'child' },
      { type: 'workflow_agent', agentId: 'a1', label: 'review:security', phaseIndex: 2, phaseTitle: '▸ dev-docs-review-wf', attempt: 1, state: 'done' },
      { type: 'workflow_agent', agentId: 'a2', label: 'scribe', phaseIndex: 2, phaseTitle: '▸ dev-docs-review-wf', attempt: 1, state: 'progress' },
    ],
  }))
  const wToku = join(sesja, 'subagents', 'workflows', 'wf_bbb-222')
  mkdirSync(wToku, { recursive: true })
  writeFileSync(join(wToku, 'journal.jsonl'), jsonl([{ type: 'launched' }]))
  return katalog
}

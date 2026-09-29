// Fixture katalogu ~/.claude/projects dla testow telemetrii — ten sam uklad co u Claude Code (przeglad D5 §1).
// Budowany w katalogu tymczasowym; wywolujacy sprzata (`rmSync`).

import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const CWD_PROJEKTU = '/Users/u/Kodowanie/projekt'
export const SKRYPT_RUNU = "export const meta = { name: 'dev-docs-review-wf' }\n"

/** @param {unknown[]} wpisy */
export const jsonl = (wpisy) => wpisy.map((w) => JSON.stringify(w)).join('\n') + '\n'

/** @param {string} id @param {number} out */
export const transkrypt = (id, out) => jsonl([
  { type: 'user', cwd: CWD_PROJEKTU, message: { content: 'Jestes reviewerem fazy 1.' } },
  { type: 'assistant', cwd: CWD_PROJEKTU, timestamp: '2026-09-23T10:00:00.000Z', effort: 'high', message: { id, model: 'claude-opus-5-5', content: [], usage: { input_tokens: 1, cache_creation_input_tokens: 100, cache_read_input_tokens: 0, output_tokens: out } } },
])

/**
 * Jeden projekt, jedna sesja: run wf_aaa-111 zakonczony (plik harnessu) i run wf_bbb-222 bez pliku harnessu.
 * @param {string} [katalog] katalog projektow (domyslnie nowy katalog tymczasowy)
 * @returns {string} katalog projektow
 */
export function zbudujFixture(katalog = mkdtempSync(join(tmpdir(), 'telemetria-projekty-'))) {
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
    runId: 'wf_aaa-111', status: 'completed', workflowName: 'dev-docs-review-wf', durationMs: 60000, startTime: 1000, script: SKRYPT_RUNU,
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
  // Sesja glowna: epizod /dev-plan z jednym subagentem researchu, potem /dev-docs (ostatni epizod pliku = otwarty).
  writeFileSync(join(katalog, '-Users-u-Kodowanie-projekt', 'sesja-1.jsonl'), jsonl([
    { type: 'user', uuid: 'u1', cwd: CWD_PROJEKTU, timestamp: '2026-09-20T10:00:00.000Z', message: { content: '<command-name>/dev-plan</command-name>' } },
    { type: 'assistant', timestamp: '2026-09-20T10:01:00.000Z', message: { id: 'g1', content: [{ type: 'tool_use', id: 'toolu-agent', name: 'Agent' }], usage: { input_tokens: 0, cache_creation_input_tokens: 800, cache_read_input_tokens: 0, output_tokens: 0 } } },
    { type: 'user', uuid: 'u2', timestamp: '2026-09-20T10:30:00.000Z', message: { content: '<command-name>/dev-docs</command-name>' } },
    { type: 'assistant', timestamp: '2026-09-20T10:31:00.000Z', message: { id: 'g2', content: [], usage: { input_tokens: 0, cache_creation_input_tokens: 400, cache_read_input_tokens: 0, output_tokens: 0 } } },
  ]))
  const subagenci = join(sesja, 'subagents')
  writeFileSync(join(subagenci, 'agent-r1.meta.json'), JSON.stringify({ agentType: 'repo-research-analyst', toolUseId: 'toolu-agent' }))
  writeFileSync(join(subagenci, 'agent-r1.jsonl'), transkrypt('r1', 0))
  return katalog
}

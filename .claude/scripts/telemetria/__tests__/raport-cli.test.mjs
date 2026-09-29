// Test CLI raport.mjs (It. 1, krok 6): okres, filtr projektu, pliki wyniku.

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'raport.mjs')

const REKORDY = [
  { typ: 'run', klucz: 'wf_1|run|wf_1', run: 'wf_1', projekt: 'p', workflow: 'dev-autopilot', zadanie: 'z', status: 'STOP', stop_kategoria: 'czystosc', start: '2026-09-10T10:00:00.000Z', pr: null },
  { typ: 'agent', klucz: 'wf_1|agent|a', run: 'wf_1', projekt: 'p', id: 'a', rola: 'build', klasa_roli: 'builder', model: 'claude-opus-5-5', effort: 'high', koszt_jedn: 1_000_000, ctx_start: 135_000, start: '2026-09-10T10:00:00.000Z', kontekst: { narzedzia_n: 972, claude_md_zn: 17_800 } },
  { typ: 'agent', klucz: 'wf_2|agent|b', run: 'wf_2', projekt: 'p', id: 'b', rola: 'build', klasa_roli: 'builder', model: 'claude-opus-5-5', effort: 'high', koszt_jedn: 7, ctx_start: 1, start: '2026-08-10T10:00:00.000Z', kontekst: {} },
  { typ: 'agent', klucz: 'wf_3|agent|c', run: 'wf_3', projekt: 'inny', id: 'c', rola: 'build', klasa_roli: 'builder', model: 'claude-opus-5-5', effort: 'high', koszt_jedn: 5, ctx_start: 1, start: '2026-09-10T10:00:00.000Z', kontekst: {} },
]

test('raport za okres i projekt: tylko rekordy z okresu, sekcje i CSV rol', () => {
  const k = mkdtempSync(join(tmpdir(), 'telemetria-raport-'))
  try {
    const plik = join(k, 'pipeline.jsonl')
    writeFileSync(plik, REKORDY.map((r) => JSON.stringify(r)).join('\n') + '\n')
    const w = spawnSync(process.execPath, [CLI, '--od', '2026-09-01', '--do', '2026-09-30', '--projekt', 'p', '--bez-skanu', '--plik', plik, '--wyj', k], { encoding: 'utf8' })
    assert.equal(w.status, 0, w.stderr)
    const txt = readFileSync(join(k, 'raport-2026-09-01_2026-09-30-p.txt'), 'utf8')
    assert.match(txt, /1\. Koszt/)
    assert.match(txt, /agentow: 1\b/, 'agent z sierpnia i z innego projektu poza raportem')
    assert.match(txt, /builder\s+claude-opus-5-5\s+n=1\s+ctx_start p50 135k/)
    assert.match(txt, /czystosc 1/)
    const csv = readFileSync(join(k, 'raport-2026-09-01_2026-09-30-p-role.csv'), 'utf8')
    assert.equal(csv.trim().split('\n')[1], 'build,builder,1,1000000,1000000')
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('brak --od/--do: blad uzycia', () => {
  const w = spawnSync(process.execPath, [CLI, '--bez-skanu'], { encoding: 'utf8' })
  assert.equal(w.status, 2)
  assert.match(w.stderr, /--od/)
})

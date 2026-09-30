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

test('raport liczy tylko pipeline dev-*: workflowy analiz osobnym wierszem, run bez harnessu zostaje (nie wiadomo czyj)', () => {
  const k = mkdtempSync(join(tmpdir(), 'telemetria-raport-'))
  const start = '2026-09-10T10:00:00.000Z'
  /** @param {string} run @param {string} id @param {number} koszt */
  const agent = (run, id, koszt) => ({ typ: 'agent', klucz: `${run}|agent|${id}`, run, projekt: 'p', id, rola: 'review:security', klasa_roli: 'reviewer',
    model: 'claude-opus-5-5', effort: 'high', koszt_jedn: koszt, ctx_start: koszt, start, kontekst: { narzedzia_n: 13 } })
  const rekordy = [
    { typ: 'run', klucz: 'wf_d|run|wf_d', run: 'wf_d', projekt: 'p', workflow: 'dev-autopilot', status: 'OK', start, pr: null },
    { typ: 'run', klucz: 'wf_a|run|wf_a', run: 'wf_a', projekt: 'p', workflow: 'test-review-wariant0', status: 'OK', start, pr: null },
    { typ: 'run', klucz: 'wf_k|run|wf_k', run: 'wf_k', projekt: 'p', workflow: null, status: 'KILLED', start, pr: null },
    agent('wf_d', 'd1', 120_000), agent('wf_a', 'a1', 50_000), agent('wf_a', 'a2', 50_000), agent('wf_k', 'k1', 110_000),
  ]
  try {
    const plik = join(k, 'pipeline.jsonl')
    writeFileSync(plik, rekordy.map((r) => JSON.stringify(r)).join('\n') + '\n')
    const w = spawnSync(process.execPath, [CLI, '--od', '2026-09-01', '--do', '2026-09-30', '--bez-skanu', '--plik', plik, '--wyj', k], { encoding: 'utf8' })
    assert.equal(w.status, 0, w.stderr)
    const txt = readFileSync(join(k, 'raport-2026-09-01_2026-09-30.txt'), 'utf8')
    assert.match(txt, /agentow: 2; runow: 2;/)
    assert.match(txt, /poza pipeline'em \(analizy, testy\): 1 runow, 2 agentow, 0\.1 M/)
    assert.match(txt, /reviewer\s+claude-opus-5-5\s+n=2\s+ctx_start p50 120k/, 'kontekst bez agentow analiz')
    assert.doesNotMatch(txt, /test-review-wariant0/)
    assert.match(txt, /\(bez harnessu\)\s+KILLED 1/)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('uwagi bota bez wagi: raport pisze „bez klasyfikacji”, nie „0 P1/P2”', () => {
  const k = mkdtempSync(join(tmpdir(), 'telemetria-raport-'))
  const start = '2026-09-10T10:00:00.000Z'
  /** @param {string} id @param {string} zadanie @param {Record<string, unknown>} pr */
  const run = (id, zadanie, pr) => ({ typ: 'run', klucz: `${id}|run|${id}`, run: id, projekt: 'p', workflow: 'dev-pr', zadanie, status: 'OK', start, pr })
  const rekordy = [
    run('wf_s', 'stare', { pliki: null, klasy: [{ id: 'A', severity: null }, { id: 'B', severity: null }] }),
    run('wf_n', 'nowe', { pliki: 40, klasy: [{ id: 'C', severity: 'P2' }, { id: 'D', severity: 'P3' }] }),
  ]
  try {
    const plik = join(k, 'pipeline.jsonl')
    writeFileSync(plik, rekordy.map((r) => JSON.stringify(r)).join('\n') + '\n')
    const w = spawnSync(process.execPath, [CLI, '--od', '2026-09-01', '--do', '2026-09-30', '--bez-skanu', '--plik', plik, '--wyj', k], { encoding: 'utf8' })
    assert.equal(w.status, 0, w.stderr)
    const txt = readFileSync(join(k, 'raport-2026-09-01_2026-09-30.txt'), 'utf8')
    assert.match(txt, /stare: 2 watkow bez klasyfikacji \(sprzed slownika klas\)/)
    assert.doesNotMatch(txt, /stare: 0 P1\/P2/)
    assert.match(txt, /nowe: 1 P1\/P2 z 2 watkow, 2\.5 na 100 plikow/)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('brak --od/--do: blad uzycia', () => {
  const w = spawnSync(process.execPath, [CLI, '--bez-skanu'], { encoding: 'utf8' })
  assert.equal(w.status, 2)
  assert.match(w.stderr, /--od/)
})

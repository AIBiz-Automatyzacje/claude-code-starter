// Test hooka Stop (It. 1, krok 5): komenda z .claude/settings.json uruchomiona tak, jak robi to Claude Code —
// przez powloke, z $CLAUDE_PROJECT_DIR i wejsciem hooka na stdin. HOME podstawiony, zeby nie dotykac prawdziwej telemetrii.

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { odczytajRekordy } from '../zapis.mjs'
import { zbudujFixture } from './fixture-projekty.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const LIMIT_CZASU_HOOKA_S = 30

function komendaHooka() {
  const ustawienia = JSON.parse(readFileSync(join(REPO, '.claude', 'settings.json'), 'utf8'))
  const hooki = ustawienia.hooks.Stop.flatMap((/** @type {{ hooks: Array<{ command: string, timeout?: number }> }} */ b) => b.hooks)
  return hooki.find((/** @type {{ command: string }} */ h) => h.command.includes('telemetria/zbierz.mjs'))
}

/** @param {string} katalog @param {number} sekundy */
function postarz(katalog, sekundy) {
  for (const n of readdirSync(katalog)) {
    const p = join(katalog, n)
    if (statSync(p).isDirectory()) postarz(p, sekundy)
    utimesSync(p, sekundy, sekundy)
  }
}

/** @param {string} stdin @param {(home: string) => void} [przygotuj] */
function uruchomHook(stdin, przygotuj) {
  const home = mkdtempSync(join(tmpdir(), 'telemetria-home-'))
  const projekty = join(home, '.claude', 'projects')
  mkdirSync(projekty, { recursive: true })
  zbudujFixture(projekty)
  przygotuj?.(home)
  const hook = komendaHooka()
  const wynik = spawnSync('/bin/sh', ['-c', hook.command], {
    input: stdin, encoding: 'utf8', env: { ...process.env, HOME: home, CLAUDE_PROJECT_DIR: REPO },
  })
  return { wynik, home, plik: join(home, '.claude', 'telemetry', 'pipeline.jsonl') }
}

test('settings.json: hook Stop wola zbierz.mjs --hook z limitem czasu', () => {
  const hook = komendaHooka()
  assert.ok(hook, 'brak hooka telemetrii w bloku Stop')
  assert.match(hook.command, /zbierz\.mjs" --hook$/)
  assert.ok(hook.timeout && hook.timeout <= LIMIT_CZASU_HOOKA_S)
})

test('hook po odpowiedzi: exit 0, pusty stdout (zero tokenow), rekord zakonczonego runu zapisany', () => {
  const { wynik, home, plik } = uruchomHook(JSON.stringify({ session_id: 'inna', hook_event_name: 'Stop', background_tasks: [] }))
  try {
    assert.equal(wynik.status, 0, wynik.stderr)
    assert.equal(wynik.stdout, '')
    assert.equal(odczytajRekordy(plik).ostatnie.get('wf_aaa-111|run|wf_aaa-111')?.status, 'OK')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('pierwszy hook bez znacznika nie robi pelnego skanu historii (tylko ostatnia doba)', () => {
  const dwieDobyTemu = Date.now() / 1000 - 2 * 24 * 3600
  const { wynik, home, plik } = uruchomHook(JSON.stringify({ session_id: 'inna' }), (h) => postarz(join(h, '.claude', 'projects'), dwieDobyTemu))
  try {
    assert.equal(wynik.status, 0)
    assert.equal(odczytajRekordy(plik).ostatnie.has('wf_aaa-111|run|wf_aaa-111'), false, 'stara historia = reczny --skan, nie hook')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

// Test CLI zbierz.mjs (It. 1, kroki 4–5): tryb hooka Stop nigdy nie blokuje sesji i nic nie wypisuje (zero tokenow).

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

import { odczytajRekordy } from '../zapis.mjs'
import { zbudujFixture } from './fixture-projekty.mjs'

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'zbierz.mjs')

/** @param {string[]} argumenty @param {string} stdin */
function uruchom(argumenty, stdin) {
  const projekty = zbudujFixture()
  const wyjscie = mkdtempSync(join(tmpdir(), 'telemetria-cli-'))
  const pliki = { plik: join(wyjscie, 'pipeline.jsonl'), bledy: join(wyjscie, 'bledy.log'), znacznik: join(wyjscie, 'znacznik.txt') }
  const wynik = spawnSync(process.execPath, [CLI, ...argumenty, '--projekty', projekty, '--plik', pliki.plik, '--bledy', pliki.bledy, '--znacznik', pliki.znacznik], {
    input: stdin, encoding: 'utf8',
  })
  return { wynik, pliki, sprzatnij: () => { rmSync(projekty, { recursive: true, force: true }); rmSync(wyjscie, { recursive: true, force: true }) } }
}

test('hook z poprawnym wejsciem: exit 0, pusty stdout, rekordy zapisane, znacznik ustawiony', () => {
  const { wynik, pliki, sprzatnij } = uruchom(['--hook'], JSON.stringify({ session_id: 'inna-sesja', hook_event_name: 'Stop', background_tasks: [] }))
  try {
    assert.equal(wynik.status, 0)
    assert.equal(wynik.stdout, '')
    assert.ok(odczytajRekordy(pliki.plik).ostatnie.has('wf_aaa-111|run|wf_aaa-111'))
    assert.ok(existsSync(pliki.znacznik))
  } finally {
    sprzatnij()
  }
})

test('hook z uszkodzonym wejsciem: exit 0, pusty stdout, blad w logu', () => {
  const { wynik, pliki, sprzatnij } = uruchom(['--hook'], '{nie json')
  try {
    assert.equal(wynik.status, 0)
    assert.equal(wynik.stdout, '')
    assert.match(readFileSync(pliki.bledy, 'utf8'), /hook/)
  } finally {
    sprzatnij()
  }
})

test('hook: sesja z dzialajacym workflowem nie zapisuje swoich epizodow skilli', () => {
  const stdin = JSON.stringify({ session_id: 'sesja-1', background_tasks: [{ id: 'x', type: 'workflow', status: 'running' }] })
  const { pliki, sprzatnij } = uruchom(['--hook'], stdin)
  try {
    assert.equal(odczytajRekordy(pliki.plik).ostatnie.has('skill|u1'), false)
  } finally {
    sprzatnij()
  }
})

test('--skan recznie: podsumowanie na stdout', () => {
  const { wynik, sprzatnij } = uruchom(['--skan'], '')
  try {
    assert.equal(wynik.status, 0)
    assert.match(wynik.stdout, /dopisanych: \d+/)
  } finally {
    sprzatnij()
  }
})

test('bez trybu: blad uzycia, exit 2', () => {
  const { wynik, sprzatnij } = uruchom([], '')
  try {
    assert.equal(wynik.status, 2)
    assert.match(wynik.stderr, /--skan/)
  } finally {
    sprzatnij()
  }
})

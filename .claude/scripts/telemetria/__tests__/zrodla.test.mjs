// Test odczytu zrodel z dysku (It. 1, krok 1): runy, journal, rekordy agentow jednego runu.
// Fixture budowany w katalogu tymczasowym — ten sam uklad co ~/.claude/projects (przeglad D5 §1).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { agenciRunu, czytajJournal, czytajJsonl, instrukcjeStale, katalogProjektu, znajdzRuny } from '../zrodla.mjs'
import { CWD_PROJEKTU, jsonl, zbudujFixture } from './fixture-projekty.mjs'

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

test('katalogProjektu: cwd z transkryptu agenta; run bez transkryptow = null', () => {
  const katalog = zbudujFixture()
  try {
    const [zakonczony, wToku] = znajdzRuny(katalog)
    assert.equal(katalogProjektu(zakonczony), CWD_PROJEKTU)
    assert.equal(katalogProjektu(wToku), null)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

// Liczba instrukcji warstwy stalej w telemetrii (PLAN-POPRAWY P11): pozycje bloku `## Polecenia` pliku roli z projektu
// runu — ten sam licznik co test szablonu i doctor; bez STOP-u, sama liczba do raportu budzetu.
const ROLA = '---\nname: security-sentinel\n---\n\nSzukasz podatnosci.\n\n## Polecenia\n\n- Wypisz bramki.\n- Zglaszaj finding.\n'

/** @returns {string} katalog projektu z plikami rol */
function projektZRolami() {
  const projekt = mkdtempSync(join(tmpdir(), 'telemetria-role-'))
  mkdirSync(join(projekt, '.claude', 'agents'), { recursive: true })
  writeFileSync(join(projekt, '.claude', 'agents', 'security-sentinel.md'), ROLA)
  writeFileSync(join(projekt, '.claude', 'agents', 'stary.md'), '---\nname: stary\n---\n\nYou are an expert.\n')
  return projekt
}

test('instrukcjeStale: pozycje bloku polecen pliku roli; plik bez bloku, brak pliku, typu albo projektu = null', () => {
  const projekt = projektZRolami()
  try {
    assert.equal(instrukcjeStale(projekt, 'security-sentinel'), 2)
    assert.equal(instrukcjeStale(projekt, 'stary'), null)
    assert.equal(instrukcjeStale(projekt, 'nie-ma'), null)
    assert.equal(instrukcjeStale(projekt, null), null)
    assert.equal(instrukcjeStale(null, 'security-sentinel'), null)
  } finally {
    rmSync(projekt, { recursive: true, force: true })
  }
})

test('agenciRunu: instrukcje_stale z pliku roli w katalogu projektu runu (cwd transkryptu)', () => {
  const katalog = zbudujFixture()
  const projekt = projektZRolami()
  try {
    const run = znajdzRuny(katalog)[0]
    for (const id of ['a1', 'a2']) {
      writeFileSync(join(run.katalogRunu, `agent-${id}.jsonl`), jsonl([{ type: 'user', cwd: projekt, message: { content: 'Review fazy 1.' } }]))
    }
    const agenci = agenciRunu(run)
    assert.equal(agenci.find((a) => a.id === 'a1')?.instrukcje_stale, 2)
    assert.equal(agenci.find((a) => a.id === 'a2')?.instrukcje_stale, null, 'scribe bez agentType')
  } finally {
    rmSync(katalog, { recursive: true, force: true })
    rmSync(projekt, { recursive: true, force: true })
  }
})

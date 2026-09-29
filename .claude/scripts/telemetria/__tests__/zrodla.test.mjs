// Test odczytu zrodel z dysku (It. 1, krok 1): runy, journal, rekordy agentow jednego runu.
// Fixture budowany w katalogu tymczasowym — ten sam uklad co ~/.claude/projects (przeglad D5 §1).

import { rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { agenciRunu, czytajJournal, czytajJsonl, katalogProjektu, znajdzRuny } from '../zrodla.mjs'
import { CWD_PROJEKTU, zbudujFixture } from './fixture-projekty.mjs'

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

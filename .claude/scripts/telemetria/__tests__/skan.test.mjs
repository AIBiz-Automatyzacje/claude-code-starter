// Test skladania rekordow jednego runu (It. 1, krok 2): run + fazy + agenci; run w toku pomijany.

import { rmSync } from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'

import { PROG_CISZY_MS } from '../run.mjs'
import { rekordyRunu } from '../skan.mjs'
import { znajdzRuny } from '../zrodla.mjs'
import { zbudujFixture } from './fixture-projekty.mjs'

test('run zakonczony: rekord run ze statusem z harnessu, faza i agenci', () => {
  const katalog = zbudujFixture()
  try {
    const r = rekordyRunu(znajdzRuny(katalog)[0], { terazMs: Date.now(), runyWToku: new Set() })
    assert.ok(r)
    assert.equal(r.run.status, 'OK')
    assert.equal(r.run.workflow, 'dev-docs-review')
    assert.equal(r.run.zadanie, 'zadanie-x', 'dev-docs-review dostaje sciezke zadania w args.sciezka')
    assert.equal(r.run.koszt.agentow, 2)
    assert.deepEqual(r.fazy.map((f) => f.faza), [1])
    assert.equal(r.agenci.length, 2)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

test('run bez harnessu prowadzony przez zywa sesje: pominiety', () => {
  const katalog = zbudujFixture()
  try {
    const wToku = znajdzRuny(katalog)[1]
    assert.equal(rekordyRunu(wToku, { terazMs: Date.now(), runyWToku: new Set([wToku.run]) }), null)
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

test('run bez harnessu, cichy ponad prog, bez sesji: KILLED', () => {
  const katalog = zbudujFixture()
  try {
    const r = rekordyRunu(znajdzRuny(katalog)[1], { terazMs: Date.now() + PROG_CISZY_MS + 60000, runyWToku: new Set() })
    assert.equal(r?.run.status, 'KILLED')
    assert.equal(r?.run.powod, 'sesja zakonczona')
  } finally {
    rmSync(katalog, { recursive: true, force: true })
  }
})

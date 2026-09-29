// Test skanu maszyny (It. 1, krok 4): runy + epizody skilli → rekordy ze wspolnymi polami → jeden plik JSONL.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { WERSJA_REKORDU, zbierzWszystko } from '../zbieranie.mjs'
import { odczytajRekordy } from '../zapis.mjs'
import { zbudujFixture } from './fixture-projekty.mjs'

/** @param {(k: { projekty: string, plik: string, bledy: string }) => void} cialo */
function zFixture(cialo) {
  const projekty = zbudujFixture()
  const wyjscie = mkdtempSync(join(tmpdir(), 'telemetria-wyjscie-'))
  try {
    cialo({ projekty, plik: join(wyjscie, 'pipeline.jsonl'), bledy: join(wyjscie, 'bledy.log') })
  } finally {
    rmSync(projekty, { recursive: true, force: true })
    rmSync(wyjscie, { recursive: true, force: true })
  }
}

const TERAZ = Date.parse('2026-09-29T12:00:00.000Z')

test('pelny skan: rekord run, faza, agenci i epizody skilli ze wspolnymi polami', () => {
  zFixture(({ projekty, plik, bledy }) => {
    const wynik = zbierzWszystko({ projekty, plik, bledy, terazMs: TERAZ, szybko: false, sesjeWToku: new Set(), pominSesje: new Set() })
    assert.ok(wynik)
    const r = odczytajRekordy(plik).ostatnie
    const run = r.get('wf_aaa-111|run|wf_aaa-111')
    assert.equal(run?.status, 'OK')
    assert.equal(run?.projekt, 'projekt', 'projekt = nazwa katalogu repo (cwd), nie slug')
    assert.equal(run?.v, WERSJA_REKORDU)
    assert.equal(typeof run?.ts, 'string')
    assert.equal(r.get('wf_aaa-111|agent|a1')?.zadanie, 'zadanie-x', 'agent niesie zadanie runu')
    assert.ok(r.has('wf_aaa-111|faza|1'))
    const plan = r.get('skill|u1')
    assert.equal(plan?.skill, 'dev-plan')
    assert.equal(plan?.subagenci_jedn, 126)
    assert.equal(plan?.otwarty, false)
    assert.equal(r.get('skill|u2')?.otwarty, true, 'ostatni epizod pliku zapisany jako otwarty')
  })
})

test('run bez pliku harnessu, cichy ponad 3 h: KILLED; drugi skan nic nie dopisuje', () => {
  zFixture(({ projekty, plik, bledy }) => {
    const we = { projekty, plik, bledy, terazMs: Date.now() + 4 * 3_600_000, szybko: false, sesjeWToku: new Set(), pominSesje: new Set() }
    zbierzWszystko(we)
    assert.equal(odczytajRekordy(plik).ostatnie.get('wf_bbb-222|run|wf_bbb-222')?.status, 'KILLED')
    assert.equal(zbierzWszystko(we)?.dopisanych, 0)
  })
})

test('hook: sesja z dzialajacym workflowem — jej run bez harnessu pominiety, jej epizody skilli nie zapisywane', () => {
  zFixture(({ projekty, plik, bledy }) => {
    zbierzWszystko({ projekty, plik, bledy, terazMs: Date.now() + 4 * 3_600_000, szybko: false, sesjeWToku: new Set(['sesja-1']), pominSesje: new Set(['sesja-1']) })
    const r = odczytajRekordy(plik).ostatnie
    assert.equal(r.has('wf_bbb-222|run|wf_bbb-222'), false)
    assert.equal(r.has('skill|u1'), false, 'zywa sesja hooka zmienia sie z kazda odpowiedzia — zapisze ja nastepny skan')
    assert.ok(r.has('wf_aaa-111|run|wf_aaa-111'), 'zakonczony run tej sesji zapisuje sie od razu')
  })
})

test('tryb szybki: znacznik po ostatniej zmianie plikow = nic do czytania', () => {
  zFixture(({ projekty, plik, bledy }) => {
    const wynik = zbierzWszystko({ projekty, plik, bledy, terazMs: TERAZ, szybko: true, znacznikMs: Date.now() + 3_600_000, sesjeWToku: new Set(), pominSesje: new Set() })
    assert.equal(wynik?.runow, 1, 'tylko run bez rekordu i bez harnessu jest sprawdzany zawsze (moze byc juz KILLED)')
    assert.equal(wynik?.sesji, 0)
  })
})

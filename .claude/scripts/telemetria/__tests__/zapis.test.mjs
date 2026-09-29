// Test zapisu telemetrii (It. 1, krok 4): plik tylko dopisywany, deduplikacja przy odczycie (przeglad D5 §8 pkt 2).
// Agent telemetrii dwa razy skasowal wspolny plik — skrypt NIGDY nie otwiera pliku do nadpisania.

import { appendFileSync, mkdtempSync, readFileSync, rmSync, mkdirSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

import { dopisz, doZapisu, odczytajRekordy, zZamkiem } from '../zapis.mjs'

const katalog = () => mkdtempSync(join(tmpdir(), 'telemetria-zapis-'))

/** @param {string} klucz @param {Record<string, unknown>} [pola] */
const rekord = (klucz, pola = {}) => ({ v: 1, ts: '2026-09-29T10:00:00.000Z', typ: klucz.split('|')[1], klucz, ...pola })

test('pierwszy zapis tworzy katalog i plik; drugi skan tych samych rekordow nie dopisuje nic', () => {
  const k = katalog()
  const plik = join(k, 'nowy', 'pipeline.jsonl')
  try {
    const rekordy = [rekord('wf_1|run|wf_1', { status: 'OK' }), rekord('wf_1|agent|a1', { koszt_jedn: 5 })]
    assert.equal(dopisz(plik, doZapisu(rekordy, odczytajRekordy(plik).ostatnie)), 2)
    const ponownie = rekordy.map((r) => ({ ...r, ts: '2026-09-29T11:00:00.000Z' }))
    assert.equal(dopisz(plik, doZapisu(ponownie, odczytajRekordy(plik).ostatnie)), 0, 'zmiana samego ts to nie nowa wersja')
    assert.equal(readFileSync(plik, 'utf8').trim().split('\n').length, 2)
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('run ze zmienionym statusem = nowa wersja; odczyt zwraca ostatnia', () => {
  const k = katalog()
  const plik = join(k, 'pipeline.jsonl')
  try {
    dopisz(plik, doZapisu([rekord('wf_1|run|wf_1', { status: 'KILLED' })], odczytajRekordy(plik).ostatnie))
    dopisz(plik, doZapisu([rekord('wf_1|run|wf_1', { status: 'OK' })], odczytajRekordy(plik).ostatnie))
    assert.equal(odczytajRekordy(plik).ostatnie.get('wf_1|run|wf_1')?.status, 'OK')
    assert.equal(readFileSync(plik, 'utf8').trim().split('\n').length, 2, 'stara wersja zostaje w pliku — nic nie jest nadpisywane')
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('agent zapisany raz nie dostaje nowej wersji (agentId unikalny, rekord skonczony)', () => {
  const k = katalog()
  const plik = join(k, 'pipeline.jsonl')
  try {
    dopisz(plik, doZapisu([rekord('wf_1|agent|a1', { koszt_jedn: 5 })], odczytajRekordy(plik).ostatnie))
    assert.deepEqual(doZapisu([rekord('wf_1|agent|a1', { koszt_jedn: 6 })], odczytajRekordy(plik).ostatnie), [])
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('agent zapisany starsza wersja logiki (v) dostaje nowa wersje rekordu', () => {
  const k = katalog()
  const plik = join(k, 'pipeline.jsonl')
  try {
    dopisz(plik, [rekord('wf_1|agent|a1', { v: 1, rola: 'review:e2e:retry' })])
    const nowszy = rekord('wf_1|agent|a1', { v: 2, rola: 'review:e2e' })
    assert.deepEqual(doZapisu([nowszy], odczytajRekordy(plik).ostatnie), [nowszy])
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('uszkodzona linia w pliku: odczyt ja pomija i liczy, reszta rekordow jest', () => {
  const k = katalog()
  const plik = join(k, 'pipeline.jsonl')
  try {
    dopisz(plik, [rekord('wf_1|run|wf_1')])
    appendFileSync(plik, '{"urwany zapis\n')
    dopisz(plik, [rekord('wf_2|run|wf_2')])
    const { ostatnie, uszkodzone } = odczytajRekordy(plik)
    assert.equal(uszkodzone, 1)
    assert.deepEqual([...ostatnie.keys()].sort(), ['wf_1|run|wf_1', 'wf_2|run|wf_2'])
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

test('zamek: drugi skan w tym samym czasie odpuszcza; porzucony zamek po limicie jest przejmowany', () => {
  const k = katalog()
  const plik = join(k, 'pipeline.jsonl')
  try {
    let wewnatrz = null
    const pierwszy = zZamkiem(plik, () => { wewnatrz = zZamkiem(plik, () => 'drugi'); return 'pierwszy' })
    assert.equal(pierwszy, 'pierwszy')
    assert.equal(wewnatrz, null, 'rownolegly skan nie czeka i nie dubluje pracy')
    mkdirSync(`${plik}.zamek`)
    utimesSync(`${plik}.zamek`, 1, 1)
    assert.equal(zZamkiem(plik, () => 'po przejeciu'), 'po przejeciu')
  } finally {
    rmSync(k, { recursive: true, force: true })
  }
})

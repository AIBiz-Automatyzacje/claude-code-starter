// Test epizodow skilli w sesji glownej (It. 1, krok 4): typ `skill` (d5-telemetria-rekord.txt §7 + §9, przeglad D6).
// Granica epizodu: nastepny skill albo koniec pliku — NIE pierwsza wiadomosc typu user (koszt_skilli.py konczyl dev-plan
// na powrocie subagenta w 7/19 epizodow, dev-prep na pierwszej odpowiedzi operatora w 8/15).

import test from 'node:test'
import assert from 'node:assert/strict'

import { epizodySesji, rekordSkilla, scalEpizody } from '../skill.mjs'

/** @param {string} uuid @param {string | unknown[]} content @param {Record<string, unknown>} [inne] */
const user = (uuid, content, inne = {}) => ({ type: 'user', uuid, timestamp: '2026-09-20T10:00:00.000Z', message: { content }, ...inne })
/** @param {string} id @param {number} cw @param {unknown[]} [content] @param {string} [czas] */
const asystent = (id, cw, content = [], czas = '2026-09-20T10:05:00.000Z') => ({
  type: 'assistant', timestamp: czas,
  message: { id, content, usage: { input_tokens: 0, cache_creation_input_tokens: cw, cache_read_input_tokens: 0, output_tokens: 0 } },
})

const SESJA = [
  user('u1', '<command-name>/dev-plan</command-name>'),
  asystent('m1', 100, [{ type: 'tool_use', id: 'agent-1', name: 'Agent' }]),
  user('u2', '<task-notification>subagent skonczyl</task-notification>'),
  asystent('m2', 200),
  user('u3', 'operator: tak, dalej'),
  asystent('m3', 300, [], '2026-09-20T12:00:00.000Z'),
  user('u4', '<command-name>/model</command-name>'),
  asystent('m4', 50),
  user('u5', '<command-name>/dev-docs</command-name>'),
  asystent('m5', 400, [{ type: 'tool_use', id: 'wf-1', name: 'Workflow' }]),
  user('u6', 'operator: teraz compound'),
  asystent('m6', 10, [{ type: 'tool_use', id: 's-1', name: 'Skill', input: { skill: 'dev-compound' } }]),
  asystent('m7', 20),
]

/** @param {string} skill */
const epizod = (skill) => {
  const e = epizodySesji(SESJA, 'sesja-1').find((x) => x.skill === skill)
  assert.ok(e, `brak epizodu ${skill}`)
  return e
}

test('epizod trwa przez powiadomienie, tekst operatora i komende lokalna — do nastepnego skilla', () => {
  const e = epizod('dev-plan')
  assert.deepEqual([...e.odpowiedzi.keys()], ['m1', 'm2', 'm3', 'm4'])
  assert.equal(e.zamkniety, true)
})

test('pierwsza odpowiedz konczy sie na pierwszej wiadomosci typu user (ciaglosc z koszt_skilli.py)', () => {
  assert.deepEqual([...epizod('dev-plan').pierwszaOdpowiedz.keys()], ['m1'])
})

test('wiadomosci operatora: tylko tekst czlowieka (bez powiadomien i komend lokalnych)', () => {
  assert.deepEqual([...epizod('dev-plan').operator], ['u3'])
})

test('skill wywolany narzedziem Skill otwiera nowy epizod i zamyka poprzedni', () => {
  assert.deepEqual([...epizod('dev-docs').odpowiedzi.keys()], ['m5'])
  const compound = epizod('dev-compound')
  assert.equal(compound.zrodlo, 'Skill-tool')
  assert.deepEqual([...compound.odpowiedzi.keys()], ['m6', 'm7'])
  assert.equal(compound.zamkniety, false, 'ostatni epizod pliku jest otwarty — zamyka go dopiero cisza w pliku sesji')
})

test('narzedzia epizodu: Agent i Workflow liczone osobno, subagenci po id wywolania', () => {
  assert.deepEqual([...epizod('dev-plan').subagenci], ['agent-1'])
  assert.equal(epizod('dev-docs').wywolania.workflow, 1)
})

test('sesja wznowiona: kopia wpisow w nowym pliku nie dubluje kosztu', () => {
  const kopia = epizodySesji([...SESJA.slice(0, 4), asystent('m9', 1000)], 'sesja-2')
  const oryginal = epizodySesji(SESJA, 'sesja-1')
  const scalone = scalEpizody([...oryginal, ...kopia])
  const plan = scalone.find((e) => e.skill === 'dev-plan')
  assert.ok(plan)
  assert.deepEqual([...plan.odpowiedzi.keys()].sort(), ['m1', 'm2', 'm3', 'm4', 'm9'])
  assert.equal(plan.sesja, 'sesja-1', 'sesja = plik, w ktorym epizod zaczal sie najwczesniej')
})

test('rekord skill: koszt wlasny, pierwsza odpowiedz, subagenci, wiadomosci operatora, okno', () => {
  const r = rekordSkilla(epizod('dev-plan'), () => 1000)
  assert.equal(r.typ, 'skill')
  assert.equal(r.skill, 'dev-plan')
  assert.equal(r.koszt_jedn, Math.round((100 + 200 + 300 + 50) * 1.25))
  assert.equal(r.pierwsza_odpowiedz_jedn, 125)
  assert.equal(r.subagenci_n, 1)
  assert.equal(r.subagenci_jedn, 1000)
  assert.equal(r.wiadomosci_operatora, 1)
  assert.equal(r.okno_h, 2)
  assert.equal(r.tury, 4)
})

test('subagent bez transkryptu: koszt nieznany nie jest zerem', () => {
  const r = rekordSkilla(epizod('dev-plan'), () => null)
  assert.equal(r.subagenci_n, 1)
  assert.equal(r.subagenci_jedn, null)
})

test('/exit i inne komendy wbudowane nie sa skillami', () => {
  const e = epizodySesji([
    user('u1', '<command-name>/dev-plan</command-name>'),
    asystent('m1', 10),
    user('u2', '<command-name>/exit</command-name>'),
    asystent('m2', 10),
  ], 's')
  assert.deepEqual(e.map((x) => x.skill), ['dev-plan'])
})

test('skill wywolany w pierwszej odpowiedzi innego skilla nie otwiera epizodu (zagniezdzenie)', () => {
  const zagniezdzony = epizodySesji([
    user('u1', '<command-name>/dev-pr</command-name>'),
    asystent('m1', 10, [{ type: 'tool_use', id: 's-9', name: 'Skill', input: { skill: 'dev-compound' } }]),
  ], 's')
  assert.deepEqual(zagniezdzony.map((e) => e.skill), ['dev-pr'])
})

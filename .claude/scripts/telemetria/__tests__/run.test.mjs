// Test rekordu `run` (It. 1, krok 2): status z pliku harnessu, run przerwany razem z sesja, kategoria STOP-u.
// Zrodlo statusu: przeglad D5 §8 pkt 1 (plik harnessu 156/156 runow); przerwany: mini-run (f) + decyzja O6.

import test from 'node:test'
import assert from 'node:assert/strict'

import { PROG_CISZY_MS, kategoriaStopu, rekordRunu, statusBezHarnessu, statusRunu } from '../run.mjs'

test('status z pliku harnessu: completed + wynik OK/STOP, killed, failed', () => {
  assert.deepEqual(statusRunu({ status: 'completed', result: { status: 'OK' } }), { status: 'OK', powod: null })
  assert.deepEqual(statusRunu({ status: 'completed', result: { status: 'STOP', powod: 'walidacja koncowa FAIL' } }), {
    status: 'STOP', powod: 'walidacja koncowa FAIL',
  })
  assert.deepEqual(statusRunu({ status: 'killed' }), { status: 'KILLED', powod: null })
  assert.deepEqual(statusRunu({ status: 'failed', error: 'boom' }), { status: 'FAILED', powod: 'boom' })
})

test('dev-pr: GOTOWY-DO-DECYZJI to udany run, BLAD to STOP', () => {
  assert.equal(statusRunu({ status: 'completed', result: { status: 'GOTOWY-DO-DECYZJI' } }).status, 'OK')
  assert.equal(statusRunu({ status: 'completed', result: { status: 'BLAD', powod: 'Nieznany etap' } }).status, 'STOP')
})

test('brak pliku harnessu: run prowadzony przez zywa sesje = w toku (pomijamy)', () => {
  assert.equal(statusBezHarnessu({ wTokuWSesji: true, ostatniaAktywnoscMs: 0, terazMs: PROG_CISZY_MS * 10 }), null)
})

test('brak pliku harnessu i cisza ponad prog = KILLED „sesja zakonczona”', () => {
  assert.deepEqual(statusBezHarnessu({ wTokuWSesji: false, ostatniaAktywnoscMs: 0, terazMs: PROG_CISZY_MS + 1 }), {
    status: 'KILLED', powod: 'sesja zakonczona',
  })
})

test('brak pliku harnessu, ale swieza aktywnosc = moze biec w innej sesji (pomijamy)', () => {
  assert.equal(statusBezHarnessu({ wTokuWSesji: false, ostatniaAktywnoscMs: 0, terazMs: PROG_CISZY_MS - 1 }), null)
})

test('prog ciszy ma zapas nad najdluzszym agentem w historii (6 016 s)', () => {
  assert.ok(PROG_CISZY_MS > 6016 * 1000 * 1.5)
})

test('kategoria STOP-u z powodu — prawdziwe komunikaty autopilota', () => {
  assert.equal(kategoriaStopu('niezacommitowane zmiany — zacommituj/stash przed autopilotem'), 'czystosc')
  assert.equal(kategoriaStopu('Faza 1: scribe padl 2x — findingi zweryfikowane'), 'scribe')
  assert.equal(kategoriaStopu('Faza 5: niezalezna weryfikacja wykryla 1x P1 NADAL otwarte po fixie'), 'P1')
  assert.equal(kategoriaStopu('Faza 1: 1x P1 nierozwiazane po fixie — wymagana reczna interwencja'), 'P1')
  assert.equal(kategoriaStopu('Faza 2: walidacja fixa FAIL — wymagana reczna interwencja'), 'fix-FAIL')
  assert.equal(kategoriaStopu('Srodowisko E2E nie gotowe, a .env.e2e istnieje'), 'E2E-srodowisko')
  assert.equal(kategoriaStopu('Faza 6: scenariusz E2E padl na BLOKERZE SRODOWISKA (dev-server)'), 'E2E-srodowisko')
  assert.equal(kategoriaStopu('execute fazy 5 zwrocil "partial": IU-8'), 'execute')
  assert.equal(kategoriaStopu('walidacja koncowa FAIL'), 'walidacja')
  assert.equal(kategoriaStopu('execute fazy 4 zwrocil "partial": checkbox Test: [Unit] ... flow E2E'), 'execute')
  assert.equal(kategoriaStopu('Drzewo robocze nie jest czyste: `git status --short` pokazuje zmodyfikowany plik'), 'czystosc')
  assert.equal(kategoriaStopu('Warunek 3 niespełniony: brak katalogu zadania'), 'bramka-wejscia')
  assert.equal(kategoriaStopu('Warunek 3 niespelniony: w biezacym drzewie roboczym NIE MA katalogu zadania'), 'bramka-wejscia')
  assert.equal(kategoriaStopu('Warunek 2 niespelniony: drzewo robocze nie jest czyste.'), 'czystosc')
  assert.equal(
    kategoriaStopu('execute fazy 2 zwrocil "blocked": klucz. UWAGA: poza katalogiem zadania zostaly niezacommitowane zmiany (a.ts)'),
    'execute', 'dopisek stopRun o brudnym drzewie nie jest przyczyna STOP-u',
  )
  assert.equal(kategoriaStopu('cos nowego'), 'inne')
  assert.equal(kategoriaStopu(null), null)
})

const AGENCI = [
  { id: 'a1', koszt_jedn: 100, tury: 2, in: 1, cache_w: 10, cache_r: 20, out: 3, start: '2026-09-23T10:00:00.000Z', koniec: '2026-09-23T10:01:00.000Z' },
  { id: 'a2', koszt_jedn: 50, tury: 1, in: 1, cache_w: 5, cache_r: 0, out: 1, start: '2026-09-23T10:02:00.000Z', koniec: '2026-09-23T10:03:00.000Z' },
]

test('rekord run autopilota: zadanie i liczba faz z bootstrapu, koszt z agentow, kategoria STOP', () => {
  const r = rekordRunu({
    harness: { workflowName: 'dev-autopilot-wf', durationMs: 180000, args: '@docs/active/zadanie-x', result: { status: 'STOP', powod: 'walidacja koncowa FAIL', raporty: [{ faza: 1 }] } },
    status: { status: 'STOP', powod: 'walidacja koncowa FAIL' },
    agenci: AGENCI,
    bootstrap: { nazwaZadania: 'zadanie-x', fazy: [{ numer: 1 }, { numer: 2 }] },
  })
  assert.equal(r.typ, 'run')
  assert.equal(r.workflow, 'dev-autopilot')
  assert.equal(r.zadanie, 'zadanie-x')
  assert.equal(r.status, 'STOP')
  assert.equal(r.stop_kategoria, 'walidacja')
  assert.equal(r.fazyZadania, 2)
  assert.equal(r.fazyUkonczone, 1)
  assert.deepEqual(r.koszt, { agentow: 2, tur: 3, in: 2, cache_w: 15, cache_r: 20, out: 4, jedn: 150 })
  assert.equal(r.sekundy, 180)
  assert.equal(r.start, '2026-09-23T10:00:00.000Z', 'start runu = najwczesniejszy agent, gdy harness nie ma startTime')
})

test('rekord run bez harnessu (KILLED): zadanie z argumentow niedostepne, sekundy z agentow', () => {
  const r = rekordRunu({ harness: null, status: { status: 'KILLED', powod: 'sesja zakonczona' }, agenci: AGENCI, bootstrap: null })
  assert.equal(r.workflow, null)
  assert.equal(r.zadanie, null)
  assert.equal(r.sekundy, 180)
  assert.equal(r.start, '2026-09-23T10:00:00.000Z')
})

test('rekord run ma klucze pol z producentem w pozniejszych iteracjach (null)', () => {
  const r = rekordRunu({ harness: null, status: { status: 'KILLED', powod: null }, agenci: [], bootstrap: null })
  const pola = new Map(Object.entries(r))
  for (const k of ['manual_razem', 'profil_stacku', 'smoke', 'pr', 'ogrod', 'szablon']) assert.ok(pola.has(k), k)
})

// CLI e2e.mjs (P14): kontrakt polecen, ktore wolaja agenci workflowow — JSON w jednej linii i kod wyjscia.
//
// Uruchomienie: node --test .claude/scripts/e2e/__tests__/e2e-cli.test.mjs

import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '../e2e.mjs')
const ZADANIA = '## Faza 1 — A\n\n- [ ] Test: [E2E] `a` — /a → ok\n- [ ] Test: [E2E] `b` — /b → ok\n'

/** @param {string} [zadania] */
function projekt(zadania = ZADANIA) {
  const katalog = mkdtempSync(join(tmpdir(), 'e2e-cli-'))
  mkdirSync(join(katalog, 'docs/active/z'), { recursive: true })
  writeFileSync(join(katalog, 'docs/active/z/z-zadania.md'), zadania)
  return katalog
}

/** @param {string} katalog @param {string[]} argumenty @param {string} [wejscie] */
function uruchom(katalog, argumenty, wejscie = '') {
  const w = spawnSync('node', [CLI, ...argumenty, '--projekt', katalog], { encoding: 'utf8', input: wejscie })
  return { kod: w.status, json: w.stdout.trim() ? JSON.parse(w.stdout) : null, stderr: w.stderr }
}

test('ksieguj: przebiegi z stdin zapisuje w pliku zadan i zwraca liczniki', () => {
  const k = projekt()
  const przebiegi = [{ flow: 'a', checkbox: '', wynik: 'PASS', przyczyna: 'nie-dotyczy', dowod: 'ok' }, { flow: 'b', checkbox: '', wynik: 'SKIP', przyczyna: 'srodowisko', dowod: 'ECONNREFUSED 127.0.0.1:5173' }]
  const w = uruchom(k, ['ksieguj', '--zadanie', 'docs/active/z', '--faza', '1'], JSON.stringify(przebiegi))
  assert.equal(w.kod, 0, w.stderr)
  assert.deepEqual(w.json, { plik: 'docs/active/z/z-zadania.md', odznaczone: 1, fail: 0, skip: 0, manual: 1, bezWpisu: 0, manualPozycje: [{ flow: 'b', przyczyna: 'srodowisko', powod: 'ECONNREFUSED 127.0.0.1:5173' }] })
  const tresc = readFileSync(join(k, 'docs/active/z/z-zadania.md'), 'utf8')
  assert.match(tresc, /^- \[x\] Test: \[E2E\] `a` — \/a → ok$/m)
  assert.match(tresc, /^- \[ \] Test: \[Manual\] `b` — \/b → ok \(MANUAL — srodowisko: ECONNREFUSED 127\.0\.0\.1:5173\)$/m)
  rmSync(k, { recursive: true })
})

test('ksieguj --brak-wpisu tester-padl: kazda linia fazy na [Manual]; przyczyna spoza recznych = zle argumenty', () => {
  const k = projekt()
  const w = uruchom(k, ['ksieguj', '--zadanie', 'docs/active/z', '--faza', '1', '--brak-wpisu', 'tester-padl', '--powod', 'tester E2E zwrocil null 2x'], '[]')
  assert.equal(w.kod, 0, w.stderr)
  assert.equal(w.json.manual, 2)
  assert.equal(uruchom(k, ['ksieguj', '--zadanie', 'docs/active/z', '--faza', '1', '--brak-wpisu', 'brak-seeda'], '[]').kod, 2)
  rmSync(k, { recursive: true })
})

test('manual: jeden flow na [Manual]; flow bez linii = kod 1; lista-manual zwraca pozycje dla smoke operatora', () => {
  const k = projekt()
  const w = uruchom(k, ['manual', '--zadanie', 'docs/active/z', '--faza', '1', '--flow', 'b', '--przyczyna', 'srodowisko', '--powod', 'dev server padl w trakcie runu'])
  assert.equal(w.kod, 0, w.stderr)
  assert.equal(w.json.manual, 1)
  assert.equal(w.json.bezWpisu, 0)
  const brak = uruchom(k, ['manual', '--zadanie', 'docs/active/z', '--faza', '1', '--flow', 'x', '--przyczyna', 'srodowisko', '--powod', 'p'])
  assert.equal(brak.kod, 1)
  assert.match(brak.json.blad, /nie ma niezaznaczonej linii \[E2E\] z flow x/)
  const lista = uruchom(k, ['lista-manual', '--zadanie', 'docs/active/z'])
  assert.deepEqual(lista.json, { pozycje: [{ faza: 1, tresc: 'Test: [Manual] `b` — /b → ok', przyczyna: 'srodowisko', powod: 'dev server padl w trakcie runu' }] })
  rmSync(k, { recursive: true })
})

test('scenariusze: niezaznaczone linie [E2E] fazy z obu prefiksow z flow i seedem; kopie Operator i findingi pominiete', () => {
  const k = projekt([
    '## Faza 1 — A', '',
    '- [ ] Test: [E2E] `a` (seed: e2e/seeds/a-seed.sql) — /a → ok',
    '- [x] Test: [E2E] `b` — /b → ok',
    '- [ ] Weryfikacja: [E2E] `e2e/f1-run-all.sh` — wszystkie zielone',
    '- [ ] Weryfikacja: [E2E] stary format bez flow',
    '- [ ] Operator: [E2E] `a` — kopia', '',
    '## Do poprawy po review fazy 1', '', '- [ ] [P2] [E2E] `a` — finding', '',
    '## Faza 2 — B', '', '- [ ] Test: [E2E] `c` — /c → ok', '',
  ].join('\n'))
  const w = uruchom(k, ['scenariusze', '--zadanie', 'docs/active/z', '--faza', '1'])
  assert.equal(w.kod, 0, w.stderr)
  assert.deepEqual(w.json, {
    faza: 1,
    scenariusze: [
      { tresc: 'Test: [E2E] `a` (seed: e2e/seeds/a-seed.sql) — /a → ok', flow: 'a', seed: 'e2e/seeds/a-seed.sql' },
      { tresc: 'Weryfikacja: [E2E] `e2e/f1-run-all.sh` — wszystkie zielone', flow: 'e2e/f1-run-all.sh', seed: null },
      { tresc: 'Weryfikacja: [E2E] stary format bez flow', flow: null, seed: null },
    ],
  })
  assert.deepEqual(uruchom(k, ['scenariusze', '--zadanie', 'docs/active/z', '--faza', '3']).json, { faza: 3, scenariusze: [] })
  assert.equal(uruchom(k, ['scenariusze', '--zadanie', 'docs/active/z']).kod, 2, 'bez --faza = zle argumenty')
  rmSync(k, { recursive: true })
})

test('sprawdz: brak .env.e2e przy scenariuszach (i bez --zadanie) = kod 1 i status brak-srodowiska; stop bez PID = kod 0', () => {
  const k = projekt()
  const w = uruchom(k, ['sprawdz', '--zadanie', 'docs/active/z'])
  assert.equal(w.kod, 1)
  assert.equal(w.json.status, 'brak-srodowiska')
  const bezZadania = uruchom(k, ['sprawdz'])
  assert.equal(bezZadania.kod, 1)
  assert.equal(bezZadania.json.status, 'brak-srodowiska')
  const stop = uruchom(k, ['stop'])
  assert.equal(stop.kod, 0)
  assert.equal(stop.json.posprzatano, true)
  rmSync(k, { recursive: true })
})

test('zle argumenty: brak --zadanie, zla faza, nieznane polecenie = kod 2', () => {
  const k = projekt()
  // Zmiana kontraktu (P14 S2): sprawdz i start dzialaja bez --zadanie (Doctor i Launch skilla weryfikacji).
  assert.equal(uruchom(k, ['ksieguj', '--faza', '1'], '[]').kod, 2)
  assert.equal(uruchom(k, ['ksieguj', '--zadanie', 'docs/active/z', '--faza', 'zero'], '[]').kod, 2)
  assert.equal(uruchom(k, ['cos', '--zadanie', 'docs/active/z', '--faza', '1']).kod, 2)
  assert.equal(uruchom(k, ['ksieguj', '--zadanie', 'docs/active/z', '--faza', '1'], '').kod, 2, 'puste stdin = zgubiony heredoc, nie „zero przebiegow”')
  rmSync(k, { recursive: true })
})

test('stan: serwer bez pliku PID = zyje false; zly E2E_URL w stop nie wywraca skryptu', () => {
  const k = projekt()
  writeFileSync(join(k, '.env.e2e'), 'E2E_URL=nie-url\n')
  const w = uruchom(k, ['stan'])
  assert.equal(w.kod, 0, w.stderr)
  assert.equal(w.json.zyje, false)
  assert.equal(uruchom(k, ['stop']).kod, 0)
  rmSync(k, { recursive: true })
})

// P17: polecenia, ktore wolaja agenci restartu i db-sync — kod wyjscia, JSON i argumenty (literowka w opcji = kod 2,
// a w autopilocie STOP w kazdym projekcie, wiec kontrakt opcji przypiety testem).
test('restart i advisors: kontrakt CLI — wymagane --zadanie i --faza, JSON z kodem; stara opcja --przed-pierwsza-faza = kod 2', () => {
  const k = projekt()
  try {
    assert.equal(uruchom(k, ['restart', '--faza', '1']).kod, 2)
    assert.equal(uruchom(k, ['restart', '--zadanie', 'docs/active/z']).kod, 2)
    writeFileSync(join(k, '.env.e2e'), 'E2E_URL=http://127.0.0.1:9\nE2E_START=echo nie wstaje && exit 1\n')
    const pad = uruchom(k, ['restart', '--zadanie', 'docs/active/z', '--faza', '1'])
    assert.equal(pad.kod, 1)
    assert.equal(pad.json.status, 'niepowodzenie')
    assert.match(pad.json.detal, /nie wstaje/)
    const bezScen = uruchom(k, ['restart', '--zadanie', 'docs/active/z', '--faza', '2'])
    assert.deepEqual([bezScen.kod, bezScen.json.status], [0, 'pominieto'])
    const adv = uruchom(k, ['advisors', '--baza', 'HEAD'])
    assert.equal(adv.kod, 0, adv.stderr)
    assert.equal(adv.json.status, 'brak', 'baza bez ref projektu Supabase')
    assert.equal(uruchom(k, ['start', '--przed-pierwsza-faza']).kod, 2)
  } finally {
    rmSync(k, { recursive: true, force: true })
    rmSync(`/tmp/autopilot-e2e-${k.split('/').pop()}.pid`, { force: true })
    rmSync(`/tmp/autopilot-e2e-${k.split('/').pop()}.log`, { force: true })
  }
})

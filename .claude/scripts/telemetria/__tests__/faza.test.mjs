// Test rekordow `faza` (It. 1, krok 2): raport fazy z wyniku runu + agregacja rekordow agentow + pliki fixa.
// Rekord: d5-telemetria-rekord.txt §2, §7 (fix.pliki[], review_rundy), §11 (testy_usuniete).

import test from 'node:test'
import assert from 'node:assert/strict'

import { E2E_SYNC_LIMIT_TELEMETRII, etapRoli, rekordyFaz, skrotE2eSync } from '../faza.mjs'

/**
 * @param {string} id @param {string} rola @param {number | null} faza @param {number} koszt
 * @param {Record<string, unknown>} [inne]
 */
const agent = (id, rola, faza, koszt, inne = {}) => ({
  id, rola, faza, koszt_jedn: koszt, tury: 1, in: 0, cache_w: 0, cache_r: 0, out: 0,
  klasa_roli: rola.startsWith('review:') ? (rola === 'review:e2e' ? 'tester-e2e' : 'reviewer') : null,
  findingi: null, start: '2026-09-23T10:00:00.000Z', koniec: '2026-09-23T10:10:00.000Z', ...inne,
})

const AGENCI = [
  agent('b1', 'build', 1, 400),
  agent('k1', 'kontekst:diff', 1, 20),
  agent('r1', 'review:security', 1, 200, { findingi: { p1: 1, p2: 2, p3: 0 } }),
  agent('r2', 'review:correctness', 1, 150, { findingi: { p1: 0, p2: 1, p3: 3 } }),
  agent('v1', 'verify-batch', 1, 60),
  agent('f1', 'fix', 1, 170, { koniec: '2026-09-23T10:30:00.000Z' }),
  agent('fk', 'fix:kontrola', 1, 30),
  agent('s1', 'stan:zapis', null, 10),
  agent('b2', 'build', 2, 300),
]

const WYNIK_RUNU = {
  status: 'STOP',
  faza: 2,
  powod: 'execute fazy 2 zwrocil "blocked"',
  raporty: [{
    faza: 1, gate: 'CZYSTE', cykle: 1,
    liczniki: { p1: 1, p2: 3, p3: 3, operator: 0 },
    fix: { naprawione: 7, nierozwiazaneP2: 0, p3Pominiete: 1 },
    kontrolaFixa: { pozycje: 2, naprawione: 2, walidacja: 'PASS', pominiete: [], bezSladu: 0 },
    e2eSync: 'zsynchronizowano: ' + 'x'.repeat(500),
    przebieg: { e2eCheckboxy: 4, e2ePass: 3, e2eFail: 0, e2eSkip: 1 },
  }],
}

const JOURNAL = new Map([
  ['f1', { rozpoczety: true, maWynik: true, wynik: { commity: ['abc1234'] } }],
  ['fk', { rozpoczety: true, maWynik: true, wynik: { regresje: [{ plik: 'a.ts', opis: 'x' }] } }],
])

/** @type {(commity: string[]) => import('../git.mjs').ZmianyCommitow} */
const gitFake = (commity) =>
  commity[0] === 'abc1234'
    ? { ok: true, pliki: [{ plik: 'src/a.ts', status: 'M' }, { plik: 'src/nowy.ts', status: 'A' }], linie: { plus: 12, minus: 4 } }
    : { ok: false, powod: 'bad object' }

const fazy = () => rekordyFaz({ wynikRunu: WYNIK_RUNU, agenci: AGENCI, journal: JOURNAL, zmianyFixa: gitFake })

test('jedna faza na kazdy numer z raportow i z agentow; agent poziomu runu nie tworzy fazy', () => {
  assert.deepEqual(fazy().map((f) => f.faza), [1, 2])
})

test('status fazy: z raportem = OK, faza zatrzymania = STOP', () => {
  const [f1, f2] = fazy()
  assert.equal(f1.status, 'OK')
  assert.equal(f2.status, 'STOP')
})

test('findingi per os z rekordow reviewerow', () => {
  assert.deepEqual(fazy()[0].findingi_per_os, { security: { p1: 1, p2: 2, p3: 0 }, correctness: { p1: 0, p2: 1, p3: 3 } })
})

test('koszt per etap z jednym jawnym grupowaniem', () => {
  const k = fazy()[0].koszt
  assert.equal(k.jedn, 1030)
  assert.deepEqual(k.per_etap, { execute: 400, review: 350, sceptycy: 60, mechanika_review: 20, fix: 200, orkiestracja: 0 })
})

test('fix: pliki ze statusem A/M i linie z commitow fixa; regresje z kontroli', () => {
  const f = fazy()[0]
  assert.deepEqual(f.fix?.pliki, [{ plik: 'src/a.ts', status: 'M' }, { plik: 'src/nowy.ts', status: 'A' }])
  assert.deepEqual(f.fix?.linie_diff, { plus: 12, minus: 4 })
  assert.equal(f.fix?.naprawione, 7)
  assert.equal(f.kontrolaFixa?.regresje, 1)
})

test('commity fixa zapisane z opisem („abc1234 fix(x): ...”) — do gita idzie sam hash', () => {
  const journal = new Map([['f1', { rozpoczety: true, maWynik: true, wynik: { commity: ['abc1234 fix(x): poprawki po review fazy 1', 'to nie hash'] } }]])
  /** @type {string[][]} */
  const wywolania = []
  rekordyFaz({ wynikRunu: WYNIK_RUNU, agenci: AGENCI, journal, zmianyFixa: (c) => { wywolania.push(c); return gitFake(c) } })
  assert.deepEqual(wywolania, [['abc1234']])
})

test('fix z commitem nieosiagalnym: pliki null i powod, faza nie ginie', () => {
  const journal = new Map([['f1', { rozpoczety: true, maWynik: true, wynik: { commity: ['zzz'] } }]])
  const f = rekordyFaz({ wynikRunu: WYNIK_RUNU, agenci: AGENCI, journal, zmianyFixa: gitFake })[0]
  assert.equal(f.fix?.pliki, null)
  assert.equal(f.fix?.pliki_blad, 'bad object')
})

test('e2e z przebiegu, MANUAL jeszcze bez producenta', () => {
  assert.deepEqual(fazy()[0].e2e, { checkboxy: 4, pass: 3, fail: 0, skip: 1, manual: null })
})

test('sekundy fazy od pierwszego do ostatniego agenta', () => {
  assert.equal(fazy()[0].sekundy, 30 * 60)
})

test('review_rundy = liczba uruchomien packagera w fazie', () => {
  assert.equal(fazy()[0].review_rundy, 1)
})

test('etapRoli: role mechaniczne review i petla fix', () => {
  assert.equal(etapRoli('scribe'), 'mechanika_review')
  assert.equal(etapRoli('zwin-do-poprawy'), 'fix')
  assert.equal(etapRoli('warmup:vitest'), 'execute')
  assert.equal(etapRoli('pr:zbierz'), null)
})

test('pola z producentem w pozniejszych iteracjach istnieja (null)', () => {
  const pola = new Map(Object.entries(fazy()[0]))
  for (const k of ['bramki', 'sceptyk', 'wiedza', 'dossier_zn', 'testy_usuniete']) assert.ok(pola.has(k), k)
  assert.deepEqual(Object.keys(fazy()[0].bramki).sort(), ['advisors', 'eslint', 'knip', 'migracje', 'sizeLimit', 'stryker', 'testyTypow', 'typecheck'])
})

// ── Skrot e2eSync (przeniesiony z dev-autopilot-wf.js razem z testami N6, audyt 2026-09-06) ──

test('krotki e2eSync i "n/a" przechodza bez zmian', () => {
  assert.equal(skrotE2eSync('n/a'), 'n/a')
  assert.equal(skrotE2eSync('aktualna: Remote database is up to date'), 'aktualna: Remote database is up to date')
})

test('dlugi e2eSync jest ucinany do limitu z jawnym znacznikiem i dlugoscia oryginalu', () => {
  const dlugi = 'zsynchronizowano: ' + 'x'.repeat(3300)
  const s = skrotE2eSync(dlugi)
  assert.ok(typeof s === 'string' && s.length < 300, `skrot ma ${s?.length} znakow — telemetria nie moze dalej niesc calego raportu agenta`)
  assert.ok(s.startsWith('zsynchronizowano: '), 'status na poczatku musi przetrwac — to jedyna czesc, ktorej analiza uzywa')
  assert.match(s, /uciete: 3318 znakow/, 'odbiorca ma wiedziec, ze to skrot i ile przepadlo')
  assert.match(s, /pelna tresc w logu runu/, 'skrot ma wskazywac, gdzie jest reszta')
})

test('e2eSync inny niz string (null z padnietego agenta) nie wywala telemetrii', () => {
  assert.equal(skrotE2eSync(null), null)
  assert.equal(skrotE2eSync(undefined), undefined)
})

test('limit jest sensowny: miesci status i zdanie, nie miesci raportu', () => {
  assert.ok(E2E_SYNC_LIMIT_TELEMETRII >= 120 && E2E_SYNC_LIMIT_TELEMETRII <= 400, `limit ${E2E_SYNC_LIMIT_TELEMETRII} — poza rozsadnym zakresem`)
})

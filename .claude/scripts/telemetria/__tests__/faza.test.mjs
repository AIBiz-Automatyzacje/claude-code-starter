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

// Grupa harnessu dziecka review-wf (kolejne wywolanie w tym samym runie: „▸ dev-docs-review-wf #2”).
const REVIEW_WF = '▸ dev-docs-review-wf'

const AGENCI = [
  agent('b1', 'build', 1, 400),
  agent('k1', 'dossier:zapas', 1, 20, { grupa: REVIEW_WF }),
  agent('r1', 'review:security', 1, 200, { findingi: { p1: 1, p2: 2, p3: 0 }, grupa: REVIEW_WF }),
  agent('r2', 'review:correctness', 1, 150, { findingi: { p1: 0, p2: 1, p3: 3 }, grupa: REVIEW_WF }),
  agent('v1', 'verify-batch', 1, 60, { grupa: REVIEW_WF }),
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

// Zmiana kontraktu (P7): review_rundy liczone z uruchomien review-wf (grupy harnessu), nie z agentow kontekst:diff,
// ktorych juz nie ma — dossier liczy skrypt w domknieciu, zapasowy agent startuje tylko bez dossier w args.
test('review_rundy = liczba uruchomien review-wf w fazie (rozne grupy harnessu dziecka review)', () => {
  assert.equal(fazy()[0].review_rundy, 1)
  assert.equal(fazy()[1].review_rundy, 0)
  const druga = [...AGENCI, agent('r3', 'review:security', 1, 100, { grupa: `${REVIEW_WF} #2` })]
  const f = rekordyFaz({ wynikRunu: WYNIK_RUNU, agenci: druga, journal: JOURNAL, zmianyFixa: gitFake })
  assert.equal(f[0].review_rundy, 2)
})

test('dossier_zn = znaki dossier fazy: z zapasowego agenta (to dossier dostalo review), inaczej z domkniecia; brak = null', () => {
  /** @type {Map<string, import('../agent.mjs').WynikJournala>} */
  const journal = new Map(JOURNAL)
  journal.set('k1', { rozpoczety: true, maWynik: true, wynik: { kodWyjscia: 0, dossier: { ctxZnaki: 5400 } } })
  journal.set('d1', { rozpoczety: true, maWynik: true, wynik: { status: 'completed', dossier: { ctxZnaki: 6100 } } })
  const zDomknieciem = [...AGENCI, agent('d1', 'domkniecie', 1, 50), agent('d2', 'domkniecie', 2, 50)]
  const f = rekordyFaz({ wynikRunu: WYNIK_RUNU, agenci: zDomknieciem, journal, zmianyFixa: gitFake })
  assert.equal(f[0].dossier_zn, 5400)
  const bezZapasu = rekordyFaz({ wynikRunu: WYNIK_RUNU, agenci: zDomknieciem.filter((a) => a.id !== 'k1'), journal, zmianyFixa: gitFake })
  assert.equal(bezZapasu[0].dossier_zn, 6100)
  assert.equal(f[1].dossier_zn, null, 'domkniecie bez wyniku w journalu')
})

test('wiedza = rozmiary wiedzy projektu z dossier fazy (P10): to samo zrodlo co dossier_zn; dossier bez pola = null', () => {
  /** @type {Map<string, import('../agent.mjs').WynikJournala>} */
  const journal = new Map(JOURNAL)
  const wiedza = { indeksZn: 8200, claudeMdZn: 21000, wycinekZn: 1450, wycinekWpisy: 6, wycinekPominiete: 2 }
  journal.set('d1', { rozpoczety: true, maWynik: true, wynik: { status: 'completed', dossier: { ctxZnaki: 6100, wiedza } } })
  journal.set('d2', { rozpoczety: true, maWynik: true, wynik: { status: 'completed', dossier: { ctxZnaki: 6100 } } })
  const agenci = [...AGENCI.filter((a) => a.id !== 'k1'), agent('d1', 'domkniecie', 1, 50), agent('d2', 'domkniecie', 2, 50)]
  const f = rekordyFaz({ wynikRunu: WYNIK_RUNU, agenci, journal, zmianyFixa: gitFake })
  assert.deepEqual(f[0].wiedza, { indeks_zn: 8200, claude_md_zn: 21000, wycinek_zn: 1450, wycinek_wpisy: 6, wycinek_pominiete: 2 })
  assert.equal(f[1].wiedza, null, 'dossier sprzed P10 nie ma pola wiedza')
})

test('etapRoli: role mechaniczne review i petla fix', () => {
  assert.equal(etapRoli('scribe'), 'mechanika_review')
  // Zmiana kontraktu (P7): role kontekst:diff i zwin-do-poprawy wyszly z pipeline'u; zapasowy agent dossier to mechanika review.
  assert.equal(etapRoli('dossier:zapas'), 'mechanika_review')
  assert.equal(etapRoli('kontekst:diff'), null)
  assert.equal(etapRoli('fix:poprawka'), 'fix')
  assert.equal(etapRoli('warmup:vitest'), 'execute')
  assert.equal(etapRoli('pr:zbierz'), null)
})

test('pola z producentem w pozniejszych iteracjach istnieja (null)', () => {
  const pola = new Map(Object.entries(fazy()[0]))
  for (const k of ['bramki', 'sceptyk', 'wiedza', 'testy_usuniete']) assert.ok(pola.has(k), k)
})

// ── Sceptyk asymetryczny (P9): producent z przebiegu review (etykiety po regule workflowu) ──

test('faza.sceptyk z przebiegu review: liczniki etykiet i degradacje; przebieg sprzed P9 = null', () => {
  const sceptyk = { agree: 5, disagree_evidence: 1, disagree_concern: 2, degradacje: 2 }
  const raport = { ...WYNIK_RUNU.raporty[0], przebieg: { ...WYNIK_RUNU.raporty[0].przebieg, sceptyk } }
  const [f] = rekordyFaz({ wynikRunu: { ...WYNIK_RUNU, raporty: [raport] }, agenci: AGENCI, journal: JOURNAL, zmianyFixa: gitFake })
  assert.deepEqual(f.sceptyk, sceptyk)
  assert.equal(fazy()[0].sceptyk, null)
  const zeStanu = { ...WYNIK_RUNU.raporty[0], przebieg: { sceptyk: null } }
  assert.equal(rekordyFaz({ wynikRunu: { ...WYNIK_RUNU, raporty: [zeStanu] }, agenci: AGENCI, journal: JOURNAL, zmianyFixa: gitFake })[0].sceptyk, null)
})

// ── Bramki domkniecia (P6): producent z wyniku agenta domkniecie (EXECUTE_RESULT) ──

// Zmiana kontraktu (P6 sesja 2): klucze = 10 bramek skryptu .claude/scripts/bramki (doszly migracjeSuma i testyUsuniete).
const BRAMKI = ['advisors', 'eslint', 'knip', 'migracje', 'migracjeSuma', 'sizeLimit', 'stryker', 'testyTypow', 'testyUsuniete', 'typecheck']

test('faza bez domkniecia: bramki z null na kazdej bramce, testy_usuniete null', () => {
  const f = fazy()[0]
  assert.deepEqual(Object.keys(f.bramki).sort(), BRAMKI)
  assert.ok(Object.values(f.bramki).every((b) => b === null))
  assert.equal(f.testy_usuniete, null)
})

test('bramki i testy_usuniete z wyniku domkniecia fazy; bramka nieobecna w wyniku = null', () => {
  const testUsuniety = { plik: 'src/a.test.ts', nazwa: 'dodaje', uzasadnienie: 'zmiana nazwy na "dodaje liczby"' }
  /** @type {Map<string, import('../agent.mjs').WynikJournala>} */
  const journal = new Map(JOURNAL)
  journal.set('d1', { rozpoczety: true, maWynik: true, wynik: {
    fazaNumer: 1, status: 'completed', iu: [],
    bramki: {
      eslint: { status: 'porazka', sekundy: 1.4, trafienia: 1, poNaprawie: 'ok' },
      stryker: { status: 'ok', sekundy: 12.5, trafienia: 3, poNaprawie: null },
    },
    testyUsuniete: [testUsuniety],
  } })
  const agenci = [...AGENCI, agent('d1', 'domkniecie', 1, 50)]
  const f = rekordyFaz({ wynikRunu: WYNIK_RUNU, agenci, journal, zmianyFixa: gitFake })[0]
  assert.deepEqual(f.bramki.eslint, { status: 'porazka', sekundy: 1.4, trafienia: 1, poNaprawie: 'ok' })
  assert.deepEqual(f.bramki.stryker, { status: 'ok', sekundy: 12.5, trafienia: 3, poNaprawie: null })
  assert.equal(f.bramki.typecheck, null)
  assert.deepEqual(f.testy_usuniete, [testUsuniety])
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

// P8: fix:kontrola z listami K-1…K-7 katalogu A i bramkami na plikach fixa. listy = liczba pozycji per lista (K-6: testy P1
// niezielone przed poprawka), p1_z_testem = P1 z testem czerwonym na kodzie sprzed poprawki. Stary wynik (regresje) — oba null.
test('kontrola fixa P8: pozycje per lista K i bramki; p1_z_testem z K-6; stary format = null', () => {
  /** @param {number} n */
  const lista = (n) => ({ sprawdzono: 'git diff', pozycje: Array.from({ length: n }, (_, i) => ({ plik: `a.ts:${i}`, opis: 'x' })) })
  const wynik = {
    listy: {
      'K-1': lista(1), 'K-2': lista(0), 'K-3': lista(2), 'K-4': lista(0), 'K-5': lista(0), 'K-7': lista(1),
      'K-6': { sprawdzono: 'worktree', testy: [
        { finding: 'a.ts:1', test: 'a.test.ts', czerwonyPrzedPoprawka: true },
        { finding: 'b.ts:1', test: 'b.test.ts', czerwonyPrzedPoprawka: false },
        { finding: 'c.ts:1', test: null, czerwonyPrzedPoprawka: false },
      ] },
    },
    bramki: lista(2),
  }
  /** @type {Map<string, import('../agent.mjs').WynikJournala>} */
  const journal = new Map(JOURNAL)
  journal.set('fk', { rozpoczety: true, maWynik: true, wynik })
  const [f] = rekordyFaz({ wynikRunu: WYNIK_RUNU, agenci: AGENCI, journal, zmianyFixa: gitFake })
  assert.deepEqual(f.kontrolaFixa?.listy, { 'K-1': 1, 'K-2': 0, 'K-3': 2, 'K-4': 0, 'K-5': 0, 'K-6': 2, 'K-7': 1, bramki: 2 })
  assert.equal(f.kontrolaFixa?.regresje, null)
  assert.equal(f.fix?.p1_z_testem, 1)

  const [stary] = fazy()
  assert.equal(stary.kontrolaFixa?.listy, null)
  assert.equal(stary.fix?.p1_z_testem, null)
})
